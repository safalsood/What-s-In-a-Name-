import { schema, OutputType } from "./state_GET.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";
import { cleanupInactiveRooms } from "../../helpers/roomCleanup";
import { kickInactivePlayersFromWaiting, kickInactivePlayersFromPlaying } from "../../helpers/roomPlayerKicks";
import { autoStartIfReady } from "../../helpers/roomAutoStart";
import { handleWinAdvance } from "../../helpers/roomWinAdvance";
import { handleRoundTimeout } from "../../helpers/roomTimeout";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const roomCode = url.searchParams.get("roomCode");
    const playerId = url.searchParams.get("playerId");

    if (!roomCode || !playerId) {
      return new Response(
        superjson.stringify({ error: "Missing roomCode or playerId" }), 
        { status: 400 }
      );
    }

    // Transaction to handle state updates (timeouts, cleanup, auto-start) safely
    const roomState = await db.transaction().execute(async (trx) => {
      // TASK 1: Clean up inactive rooms
      await cleanupInactiveRooms(trx);

      // Get the requested room
      const room = await trx.selectFrom("rooms")
        .selectAll()
        .where("code", "=", roomCode)
        .executeTakeFirst();

      if (!room) throw new Error("Room not found");

      // Update last seen for requesting player
      await trx.updateTable("roomPlayers")
        .set({ lastSeenAt: new Date() })
        .where("roomId", "=", room.id)
        .where("playerId", "=", playerId)
        .execute();

      // TASK 2: Kick out inactive players from waiting rooms
      let updatedRoom = room;
      if (room.status === 'waiting') {
        updatedRoom = await kickInactivePlayersFromWaiting(trx, room);
      }

      // Get updated room state after cleanup
      updatedRoom = await trx.selectFrom("rooms")
        .selectAll()
        .where("id", "=", room.id)
        .executeTakeFirstOrThrow();

      // TASK 3: Kick out inactive players from playing rooms (ghost players)
      if (updatedRoom.status === 'playing') {
        updatedRoom = await kickInactivePlayersFromPlaying(trx, updatedRoom);
      }

      // TASK 4: Auto-start when preferred player count is reached
      updatedRoom = await autoStartIfReady(trx, updatedRoom);

      // TASK 5: Check for automatic round advancement after win
      updatedRoom = await handleWinAdvance(trx, updatedRoom, roomCode);

      // TASK 6: Check for round timeout logic
      updatedRoom = await handleRoundTimeout(trx, updatedRoom, roomCode);

      const players = await trx.selectFrom("roomPlayers")
        .selectAll()
        .where("roomId", "=", updatedRoom.id)
        .orderBy("joinedAt", "asc")
        .execute();

      // TASK 7: Clear active_room_id for users if the room is finished
      if (updatedRoom.status === 'finished') {
        console.log(`Room ${updatedRoom.code} is finished, clearing active_room_id for all associated users`);
        await trx.updateTable("users")
          .set({ activeRoomId: null })
          .where("activeRoomId", "=", updatedRoom.id)
          .execute();
      }

      // Calculate shuffle vote info
      const shuffleVotes = updatedRoom.shuffleVotes || [];
      const voteCount = shuffleVotes.length;
      const voteThreshold = Math.ceil(players.length / 2);

      return { 
        room: updatedRoom, 
        players,
        shuffleVotes,
        voteCount,
        voteThreshold
      };
    });

    return new Response(
      superjson.stringify({ 
        room: roomState.room,
        players: roomState.players,
        shuffleVotes: roomState.shuffleVotes,
        voteCount: roomState.voteCount,
        voteThreshold: roomState.voteThreshold
      } satisfies OutputType),
      { status: 200 }
    );

  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500 }
    );
  }
}