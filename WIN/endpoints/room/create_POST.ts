import { schema, OutputType } from "./create_POST.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";
import { randomUUID } from "crypto";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Generate a 6-character alphanumeric room code
    const roomCode = randomUUID().substring(0, 6).toUpperCase();

    const result = await db.transaction().execute(async (trx) => {
            // Clean up any existing active rooms for this player FIRST before checking
      const existingPlayerRooms = await trx.selectFrom("roomPlayers")
        .innerJoin("rooms", "rooms.id", "roomPlayers.roomId")
        .select(["rooms.id as roomId", "rooms.code", "rooms.status", "rooms.hostId"])
        .where("roomPlayers.playerId", "=", input.playerId)
        .where("rooms.status", "in", ["waiting", "playing", "tutorial"])
        .execute();

      if (existingPlayerRooms.length > 0) {
        console.log(`Player ${input.playerId} is in ${existingPlayerRooms.length} active room(s), cleaning up...`);
        
        for (const room of existingPlayerRooms) {
          // Remove player from the room
          await trx.deleteFrom("roomPlayers")
            .where("roomId", "=", room.roomId)
            .where("playerId", "=", input.playerId)
            .execute();

          // If they were the host and room is waiting, check if room should be deleted or host transferred
          if (room.hostId === input.playerId && room.status === 'waiting') {
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

      // Clear stale active_room_id for user if it points to a non-active room
      if (input.userId !== undefined) {
        const user = await trx.selectFrom("users")
          .select(["activeRoomId"])
          .where("id", "=", input.userId)
          .executeTakeFirst();

        if (user?.activeRoomId) {
          // Check if the active room still exists and is active
          const activeRoom = await trx.selectFrom("rooms")
            .select(["status"])
            .where("id", "=", user.activeRoomId)
            .executeTakeFirst();

          // Clear active_room_id if room doesn't exist, is finished, or was just cleaned up above
          if (!activeRoom || activeRoom.status === 'finished') {
            await trx.updateTable("users")
              .set({ activeRoomId: null })
              .where("id", "=", input.userId)
              .execute();
          } else if (activeRoom.status === 'waiting' || activeRoom.status === 'playing' || activeRoom.status === 'tutorial') {
            // Check if the player is still actually in this room (they may have been cleaned up above)
            const stillInRoom = await trx.selectFrom("roomPlayers")
              .select("id")
              .where("roomId", "=", user.activeRoomId)
              .where("playerId", "=", input.playerId)
              .executeTakeFirst();
            
            if (!stillInRoom) {
              // Player was cleaned up from this room, clear active_room_id
              await trx.updateTable("users")
                .set({ activeRoomId: null })
                .where("id", "=", input.userId)
                .execute();
            } else {
              // Player is genuinely still in an active game they weren't cleaned up from
              throw new Error("This account is already active in another game.");
            }
          }
        }
      }

      // Create the new room
      const room = await trx.insertInto("rooms")
        .values({
          code: roomCode,
          hostId: input.playerId,
          roomType: input.roomType,
          maxPlayers: input.maxPlayers ?? (input.roomType === 'private' ? 12 : 10),
          minPlayers: input.roomType === 'public' ? 2 : 2,
          preferredPlayers: input.roomType === 'public' ? 3 : 0,
          status: 'waiting',
          roundNumber: 0,
          failedRounds: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning(["id", "code"])
        .executeTakeFirstOrThrow();

      // Add the host as the first player
      await trx.insertInto("roomPlayers")
        .values({
          roomId: room.id,
          playerId: input.playerId,
          playerName: input.playerName,
          isReady: true,
          joinedAt: new Date(),
          lastSeenAt: new Date(),
          collectedLetters: [],
        })
        .execute();

      // Update user's active_room_id if userId provided
      if (input.userId !== undefined) {
        await trx.updateTable("users")
          .set({ activeRoomId: room.id })
          .where("id", "=", input.userId)
          .execute();
      }

      return room;
    });

    return new Response(
      superjson.stringify({ 
        roomCode: result.code, 
        roomId: result.id 
      } satisfies OutputType),
      { status: 200 }
    );

  } catch (error) {
    console.error("Create room error:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500 }
    );
  }
}