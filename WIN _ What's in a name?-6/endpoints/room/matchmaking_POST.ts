import { schema, OutputType } from "./matchmaking_POST.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";
import { Transaction } from "kysely";
import { DB } from "../../helpers/schema";
import { randomUUID } from "crypto";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { playerName, playerId, userId } = schema.parse(json);

    // If userId is provided, check for existing active room (outside transaction for quick check)
    if (userId !== undefined) {
      const user = await db.selectFrom("users")
        .select(["activeRoomId"])
        .where("id", "=", userId)
        .executeTakeFirst();

      if (user?.activeRoomId) {
        // Check if the active room is actually active
        const activeRoom = await db.selectFrom("rooms")
          .select(["status", "code", "id"])
          .where("id", "=", user.activeRoomId)
          .executeTakeFirst();

        if (activeRoom && (activeRoom.status === 'waiting' || activeRoom.status === 'playing' || activeRoom.status === 'tutorial')) {
          console.log(`User ${userId} already in room ${activeRoom.code} with status ${activeRoom.status}`);
          return new Response(
            superjson.stringify({ 
              roomCode: activeRoom.code, 
              roomId: activeRoom.id, 
              joined: true 
            } satisfies OutputType),
            { status: 200 }
          );
        }
      }
    }

    // First, check if player is already in an active room (outside transaction for quick check)
    const existingPlayerRoom = await db.selectFrom("roomPlayers")
      .innerJoin("rooms", "rooms.id", "roomPlayers.roomId")
      .select(["rooms.id as roomId", "rooms.code", "rooms.status"])
      .where("roomPlayers.playerId", "=", playerId)
      .where("rooms.status", "in", ["waiting", "playing"])
      .executeTakeFirst();

    if (existingPlayerRoom) {
      console.log(`Player ${playerId} already in room ${existingPlayerRoom.code} with status ${existingPlayerRoom.status}`);
      return new Response(
        superjson.stringify({ 
          roomCode: existingPlayerRoom.code, 
          roomId: existingPlayerRoom.roomId, 
          joined: true 
        } satisfies OutputType),
        { status: 200 }
      );
    }

    // Wrap the entire find-or-create logic in a transaction with proper locking
    const result = await db.transaction().execute(async (trx: Transaction<DB>) => {
      // Step 1: Find candidate rooms without locking (GROUP BY to get counts)
      const candidateRooms = await trx.selectFrom("rooms")
        .leftJoin("roomPlayers", "rooms.id", "roomPlayers.roomId")
        .select(["rooms.id", "rooms.code", "rooms.maxPlayers", "rooms.preferredPlayers", "rooms.createdAt"])
        .select(trx.fn.count("roomPlayers.id").as("playerCount"))
        .where("rooms.status", "=", "waiting")
        .where("rooms.roomType", "=", "public")
        .groupBy(["rooms.id", "rooms.code", "rooms.maxPlayers", "rooms.preferredPlayers", "rooms.createdAt"])
        .orderBy("rooms.createdAt", "asc") // Prefer older rooms to fill them first
        .execute();

      // Filter to find rooms with available space and prefer rooms that already have players
      const availableRooms = candidateRooms
        .filter(r => Number(r.playerCount) < r.maxPlayers)
        .sort((a, b) => Number(b.playerCount) - Number(a.playerCount)); // Prefer rooms with more players

      console.log(`[Matchmaking] Found ${candidateRooms.length} candidate rooms, ${availableRooms.length} with space available`);
      if (availableRooms.length > 0) {
        console.log(`[Matchmaking] Best room: ${availableRooms[0].code} with ${availableRooms[0].playerCount}/${availableRooms[0].maxPlayers} players`);
      }

      if (availableRooms.length > 0) {
        // Step 2: Lock the first candidate room and re-verify
        const candidateRoomId = availableRooms[0].id;

        // Lock the specific room (no GROUP BY, so FOR UPDATE is allowed)
        const lockedRoom = await trx.selectFrom("rooms")
          .selectAll()
          .where("id", "=", candidateRoomId)
          .where("status", "=", "waiting")
          .forUpdate()
          .executeTakeFirst();

        if (!lockedRoom) {
          // Room state changed, fall through to create new room
          console.log(`Room ${candidateRoomId} state changed during lock, creating new room`);
        } else {
          // Step 3: Re-verify player count after locking
          const currentPlayerCount = await trx.selectFrom("roomPlayers")
            .select(trx.fn.count("id").as("count"))
            .where("roomId", "=", lockedRoom.id)
            .executeTakeFirstOrThrow();

          const count = Number(currentPlayerCount.count);

          if (count < lockedRoom.maxPlayers) {
            console.log(`[Matchmaking] Joining room ${lockedRoom.code} for player ${playerId} (${count}/${lockedRoom.maxPlayers} players)`);
            
            // Double-check that player doesn't exist in this specific room
            const existingInRoom = await trx.selectFrom("roomPlayers")
              .select("id")
              .where("roomId", "=", lockedRoom.id)
              .where("playerId", "=", playerId)
              .executeTakeFirst();

            if (!existingInRoom) {
              await trx.insertInto("roomPlayers")
                .values({
                  roomId: lockedRoom.id,
                  playerId: playerId,
                  playerName: playerName,
                  isReady: true,
                  joinedAt: new Date(),
                  lastSeenAt: new Date(),
                  collectedLetters: [],
                })
                .execute();
            } else {
              console.log(`[Matchmaking] Player ${playerId} already exists in room ${lockedRoom.code}, skipping insert`);
            }

            // Update user's active_room_id if userId provided
            if (userId !== undefined) {
              await trx.updateTable("users")
                .set({ activeRoomId: lockedRoom.id })
                .where("id", "=", userId)
                .execute();
            }

            return { 
              roomCode: lockedRoom.code, 
              roomId: lockedRoom.id, 
              joined: true 
            };
          } else {
            console.log(`[Matchmaking] Room ${lockedRoom.code} is full after lock (${count}/${lockedRoom.maxPlayers}), creating new room`);
          }
        }
      }

      // Step 4: No available room found - create a new public room
      console.log(`[Matchmaking] No available rooms, creating new room for player ${playerId}`);
      const roomCode = randomUUID().substring(0, 6).toUpperCase();
      
      const room = await trx.insertInto("rooms")
        .values({
          code: roomCode,
          hostId: playerId,
          roomType: 'public',
          maxPlayers: 10,
          minPlayers: 2,
          preferredPlayers: 3,
          status: 'waiting',
          roundNumber: 0,
          failedRounds: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning(["id", "code"])
        .executeTakeFirstOrThrow();

      await trx.insertInto("roomPlayers")
        .values({
          roomId: room.id,
          playerId: playerId,
          playerName: playerName,
          isReady: true,
          joinedAt: new Date(),
          lastSeenAt: new Date(),
          collectedLetters: [],
        })
        .execute();

      // Step 5: Retry mechanism - check if another room became available during our creation
      const retryRooms = await trx.selectFrom("rooms")
        .leftJoin("roomPlayers", "rooms.id", "roomPlayers.roomId")
        .select(["rooms.id", "rooms.code", "rooms.maxPlayers", "rooms.preferredPlayers"])
        .select(trx.fn.count("roomPlayers.id").as("playerCount"))
        .where("rooms.status", "=", "waiting")
        .where("rooms.roomType", "=", "public")
        .where("rooms.id", "!=", room.id)
        .groupBy(["rooms.id", "rooms.code", "rooms.maxPlayers", "rooms.preferredPlayers"])
        .having(trx.fn.count("roomPlayers.id"), ">", 0)
        .execute();

      const betterRoom = retryRooms.find(r => Number(r.playerCount) < r.maxPlayers);

      if (betterRoom) {
        console.log(`[Matchmaking] Found better room ${betterRoom.code} after creating empty room, switching player ${playerId}`);
        
        // Delete the empty room we just created
        await trx.deleteFrom("roomPlayers")
          .where("roomId", "=", room.id)
          .execute();
        
        await trx.deleteFrom("rooms")
          .where("id", "=", room.id)
          .execute();

        // Join the better room
        const existingInBetterRoom = await trx.selectFrom("roomPlayers")
          .select("id")
          .where("roomId", "=", betterRoom.id)
          .where("playerId", "=", playerId)
          .executeTakeFirst();

        if (!existingInBetterRoom) {
          await trx.insertInto("roomPlayers")
            .values({
              roomId: betterRoom.id,
              playerId: playerId,
              playerName: playerName,
              isReady: true,
              joinedAt: new Date(),
              lastSeenAt: new Date(),
              collectedLetters: [],
            })
            .execute();
        }

        // Update user's active_room_id if userId provided
        if (userId !== undefined) {
          await trx.updateTable("users")
            .set({ activeRoomId: betterRoom.id })
            .where("id", "=", userId)
            .execute();
        }

        return { 
          roomCode: betterRoom.code, 
          roomId: betterRoom.id, 
          joined: true 
        };
      }

      // No better room found, keep the one we created
      // Update user's active_room_id if userId provided
      if (userId !== undefined) {
        await trx.updateTable("users")
          .set({ activeRoomId: room.id })
          .where("id", "=", userId)
          .execute();
      }

      return { 
        roomCode: room.code, 
        roomId: room.id, 
        joined: false 
      };
    });

    return new Response(
      superjson.stringify(result satisfies OutputType),
      { status: 200 }
    );

  } catch (error) {
    console.error("Matchmaking error:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500 }
    );
  }
}