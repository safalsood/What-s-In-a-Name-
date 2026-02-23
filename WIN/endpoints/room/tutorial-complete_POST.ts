import { schema, OutputType } from "./tutorial-complete_POST.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";
import { initGameSession } from "../../helpers/gameSessionStats";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { roomCode, playerId } = schema.parse(json);

    const result = await db.transaction().execute(async (trx) => {
      // 1. Find the room by code to get the internal ID
      const room = await trx.selectFrom("rooms")
        .select("id")
        .where("code", "=", roomCode)
        .executeTakeFirst();

      if (!room) {
        throw new Error("Room not found");
      }

      // 2. Update the roomPlayers entry for this player in this room
      const updateResult = await trx.updateTable("roomPlayers")
        .set({
          tutorialComplete: true
        })
        .where("roomId", "=", room.id)
        .where("playerId", "=", playerId)
        .executeTakeFirst();

      // If numUpdatedRows is 0, it means the player isn't in the room
      if (Number(updateResult.numUpdatedRows) === 0) {
        throw new Error("Player not found in this room");
      }

      // 3. Check if the room is in tutorial status
      const roomDetails = await trx.selectFrom("rooms")
        .select(["status"])
        .where("id", "=", room.id)
        .executeTakeFirstOrThrow();

      let allTutorialsComplete = false;

      if (roomDetails.status === "tutorial") {
        // 4. Check if ALL players have completed the tutorial
        const allPlayers = await trx.selectFrom("roomPlayers")
          .select(["tutorialComplete"])
          .where("roomId", "=", room.id)
          .execute();

        const totalPlayers = allPlayers.length;
        const completedCount = allPlayers.filter(p => p.tutorialComplete).length;

        console.log(`Tutorial progress for room ${roomCode}: ${completedCount}/${totalPlayers} players completed`);

        if (completedCount === totalPlayers && totalPlayers > 0) {
          // 5. All players have completed - start the game!
          const gameStartTime = new Date();
          await trx.updateTable("rooms")
            .set({
              status: "playing",
              roundStartTime: gameStartTime
            })
            .where("id", "=", room.id)
            .execute();

          allTutorialsComplete = true;
          console.log(`All tutorials complete for room ${roomCode}, starting game!`);

          // 6. Initialize game session stats for all players
          const players = await trx.selectFrom("roomPlayers")
            .selectAll()
            .where("roomId", "=", room.id)
            .execute();

          for (const player of players) {
            // Get username from users table if exists
            const playerIdNum = parseInt(player.playerId, 10);
            const user = !isNaN(playerIdNum)
              ? await trx.selectFrom("users")
                .select("username")
                .where("id", "=", playerIdNum)
                .executeTakeFirst()
              : undefined;

            await initGameSession({
              roomId: room.id,
              playerId: player.playerId,
              playerUsername: user?.username || null,
              gameMode: "multiplayer",
              gameStartTime: gameStartTime,
              miniCategoriesSeen: 1,
              playersCount: players.length,
            });
          }
        }
      }

      return { success: true, allTutorialsComplete };
    });

    return new Response(
      superjson.stringify(result satisfies OutputType),
      { status: 200 }
    );

  } catch (error) {
    console.error("Tutorial complete error:", error);
    return new Response(
      superjson.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }), 
      { status: 400 }
    );
  }
}