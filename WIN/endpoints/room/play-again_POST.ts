import { schema, OutputType } from "./play-again_POST.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { roomCode, playerId } = schema.parse(json);

    await db.transaction().execute(async (trx) => {
      // 1. Verify room exists and is in 'finished' status
      const room = await trx.selectFrom("rooms")
        .select(["id", "status"])
        .where("code", "=", roomCode)
        .executeTakeFirst();

      if (!room) {
        throw new Error("Room not found");
      }

      if (room.status !== 'finished') {
        throw new Error("Game is not finished yet");
      }

      // 2. Verify player is in the room
      const player = await trx.selectFrom("roomPlayers")
        .select("id")
        .where("roomId", "=", room.id)
        .where("playerId", "=", playerId)
        .executeTakeFirst();

      if (!player) {
        throw new Error("Player not found in this room");
      }

      const now = new Date();

      // 3. Reset the room to 'waiting' status
      await trx.updateTable("rooms")
        .set({
          status: 'waiting',
          roundNumber: 0,
          failedRounds: 0,
          letters: null,
          baseCategory: null,
          currentMiniCategory: null,
          roundStartTime: null,
          roundWinnerId: null,
          roundWinningWord: null,
          usedMiniCategoryIds: null, // Reset used categories history
          updatedAt: now,
        })
        .where("id", "=", room.id)
        .execute();

      // 4. Reset all players in the room
      await trx.updateTable("roomPlayers")
        .set({
          collectedLetters: [], // Empty array for collected letters
          // tutorialComplete: keep existing value
          isReady: true, // Mark them as ready for the new game
          lastSeenAt: now,
        })
        .where("roomId", "=", room.id)
        .execute();
        
      // 5. Clear used words for this room to allow fresh start
      // Although the requirements didn't explicitly say to delete from usedWords table,
      // "Words cannot be reused within the SAME category" implies per game session usually.
      // However, since we are resetting the room completely (new base category will be chosen),
      // keeping old usedWords might be confusing or bloat the table. 
      // Given the requirement "Reset... usedWords: null (or empty array)", this likely refers to a field on the room or player if it existed, 
      // but `usedWords` is a separate table. 
      // Let's clear the `usedWords` table for this room to ensure a clean slate.
      await trx.deleteFrom("usedWords")
        .where("roomId", "=", room.id)
        .execute();
        
            // Also clear pending game logs if any
      await trx.deleteFrom("pendingGameLogs")
        .where("roomId", "=", room.id)
        .execute();
        
      // Clear round history for this room
      await trx.deleteFrom("roundHistory")
        .where("roomId", "=", room.id)
        .execute();
    });

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType),
      { status: 200 }
    );

  } catch (error) {
    console.error("Play again error:", error);
    return new Response(
      superjson.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 400 }
    );
  }
}