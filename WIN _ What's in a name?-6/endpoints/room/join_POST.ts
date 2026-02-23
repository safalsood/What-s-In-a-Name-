import { schema, OutputType } from "./join_POST.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { roomCode, playerName, playerId, userId } = schema.parse(json);

    const result = await db.transaction().execute(async (trx) => {
      // Check if player is already in any active rooms and clean them up
      const existingPlayerRooms = await trx.selectFrom("roomPlayers")
        .innerJoin("rooms", "rooms.id", "roomPlayers.roomId")
        .select(["rooms.id as roomId", "rooms.code", "rooms.status", "rooms.hostId"])
        .where("roomPlayers.playerId", "=", playerId)
        .where("rooms.status", "in", ["waiting", "playing", "tutorial"])
        .execute();

      if (existingPlayerRooms.length > 0) {
        console.log(`Player ${playerId} is in ${existingPlayerRooms.length} active room(s), cleaning up before join...`);
        
        for (const room of existingPlayerRooms) {
          // Remove player from the room
          await trx.deleteFrom("roomPlayers")
            .where("roomId", "=", room.roomId)
            .where("playerId", "=", playerId)
            .execute();

          // If they were the host and room is waiting, check if room should be deleted or host transferred
          if (room.hostId === playerId && room.status === 'waiting') {
            // Check if there are remaining players
            const remainingPlayers = await trx.selectFrom("roomPlayers")
              .select(["playerId", "joinedAt"])
              .where("roomId", "=", room.roomId)
              .orderBy("joinedAt", "asc")
              .execute();

                        if (remainingPlayers.length === 0) {
              // Delete the empty room and all dependent records
              await trx.deleteFrom("roundHistory").where("roomId", "=", room.roomId).execute();
              await trx.deleteFrom("pendingGameLogs").where("roomId", "=", room.roomId).execute();
              await trx.deleteFrom("usedWords").where("roomId", "=", room.roomId).execute();
              await trx.deleteFrom("wordSubmissions").where("roomId", "=", room.roomId).execute();
              await trx.deleteFrom("gameSessionStats").where("roomId", "=", room.roomId).execute();
              await trx.deleteFrom("rooms").where("id", "=", room.roomId).execute();
              console.log(`Deleted empty room ${room.code}`);
            } else {
              // Transfer host to next player
              const newHost = remainingPlayers[0];
              await trx.updateTable("rooms")
                .set({ hostId: newHost.playerId })
                .where("id", "=", room.roomId)
                .execute();
              console.log(`Transferred host of room ${room.code} to ${newHost.playerId}`);
            }
          }
        }
      }

            // Clear stale active_room_id after cleanup
      if (userId !== undefined) {
        const user = await trx.selectFrom("users")
          .select(["activeRoomId"])
          .where("id", "=", userId)
          .executeTakeFirst();

        if (user?.activeRoomId) {
          const activeRoom = await trx.selectFrom("rooms")
            .select(["status"])
            .where("id", "=", user.activeRoomId)
            .executeTakeFirst();

          // Clear if room doesn't exist or is finished
          if (!activeRoom || activeRoom.status === 'finished') {
            await trx.updateTable("users")
              .set({ activeRoomId: null })
              .where("id", "=", userId)
              .execute();
          } else {
            // Check if player is still actually in the active room (might have been cleaned up above)
            const stillInRoom = await trx.selectFrom("roomPlayers")
              .select("id")
              .where("roomId", "=", user.activeRoomId)
              .where("playerId", "=", playerId)
              .executeTakeFirst();
            
            if (!stillInRoom) {
              await trx.updateTable("users")
                .set({ activeRoomId: null })
                .where("id", "=", userId)
                .execute();
            }
          }
        }
      }

      // Find the room to join
      const room = await trx.selectFrom("rooms")
        .select(["id", "status", "maxPlayers"])
        .where("code", "=", roomCode)
        .executeTakeFirst();

      if (!room) {
        return { success: false, error: "Room not found" };
      }

      if (room.status !== 'waiting') {
        // Allow re-joining if player is already in the room
        const existingPlayer = await trx.selectFrom("roomPlayers")
          .select("id")
          .where("roomId", "=", room.id)
          .where("playerId", "=", playerId)
          .executeTakeFirst();
          
        if (existingPlayer) {
           return { success: true, roomId: room.id };
        }
        
        return { success: false, error: "Game already in progress" };
      }

      // Check capacity
      const playerCount = await trx.selectFrom("roomPlayers")
        .select(trx.fn.count("id").as("count"))
        .where("roomId", "=", room.id)
        .executeTakeFirst();

      const currentCount = Number(playerCount?.count ?? 0);
      if (currentCount >= room.maxPlayers) {
        return { success: false, error: "Room is full" };
      }

      // Check if player already exists (idempotency)
      const existingPlayer = await trx.selectFrom("roomPlayers")
        .select("id")
        .where("roomId", "=", room.id)
        .where("playerId", "=", playerId)
        .executeTakeFirst();

      if (!existingPlayer) {
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
      }

      // Update user's active_room_id if userId provided
      if (userId !== undefined) {
        await trx.updateTable("users")
          .set({ activeRoomId: room.id })
          .where("id", "=", userId)
          .execute();
      }

      return { success: true, roomId: room.id };
    });

    if (!result.success) {
       return new Response(
        superjson.stringify(result satisfies OutputType),
        { status: 400 }
      );
    }

    return new Response(
      superjson.stringify(result satisfies OutputType),
      { status: 200 }
    );

  } catch (error) {
    console.error("Join room error:", error);
    return new Response(
      superjson.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500 }
    );
  }
}