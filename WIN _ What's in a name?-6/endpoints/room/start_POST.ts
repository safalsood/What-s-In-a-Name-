import { schema, OutputType } from "./start_POST.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";
import { startGameRound } from "../../helpers/roomGameStart";
import { initGameSession } from "../../helpers/gameSessionStats";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { roomCode, playerId } = schema.parse(json);

    await db.transaction().execute(async (trx) => {
      const room = await trx.selectFrom("rooms")
        .selectAll()
        .where("code", "=", roomCode)
        .executeTakeFirst();

      if (!room) throw new Error("Room not found");
      if (room.hostId !== playerId) throw new Error("Only host can start game");

      // Get all players to check tutorial status
      const players = await trx.selectFrom("roomPlayers")
        .selectAll()
        .where("roomId", "=", room.id)
        .execute();

      // If called during tutorial phase, force all players' tutorials to complete
      if (room.status === 'tutorial') {
        console.log("Host forcing tutorial skip - marking all tutorials complete");
        await trx.updateTable("roomPlayers")
          .set({ tutorialComplete: true })
          .where("roomId", "=", room.id)
          .execute();

        // Transition to playing with timer started
        const gameStartTime = new Date();
        await trx.updateTable("rooms")
          .set({
            status: 'playing',
            roundStartTime: gameStartTime,
            updatedAt: gameStartTime,
          })
          .where("id", "=", room.id)
          .execute();

        // Initialize game session stats for all players
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

        return;
      }

      // Check if ANY player needs tutorial
      const anyPlayerNeedsTutorial = players.some(p => !p.tutorialComplete);

      // Use shared game start logic
      const isFirstRound = room.status === 'waiting';
      const skipToPlaying = !anyPlayerNeedsTutorial;
      
      await startGameRound(trx, {
        roomId: room.id,
        room: room,
        isFirstRound: isFirstRound,
        skipToPlaying: skipToPlaying,
      });

      // Initialize game session stats if going directly to 'playing' (skipToPlaying=true)
      if (skipToPlaying && isFirstRound) {
        const gameStartTime = new Date();
        
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
    });

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType),
      { status: 200 }
    );

  } catch (error) {
    console.error("Start game error:", error);
    return new Response(
      superjson.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 400 }
    );
  }
}