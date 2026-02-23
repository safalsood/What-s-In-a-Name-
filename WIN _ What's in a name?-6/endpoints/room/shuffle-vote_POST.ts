import { schema, OutputType } from "./shuffle-vote_POST.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";
import { generateRoundLetters } from "../../helpers/gameLogic";
import { selectMiniCategory } from "../../helpers/categoryManager";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { roomCode, playerId } = schema.parse(json);

    const result = await db.transaction().execute(async (trx) => {
      // 1. Fetch Room
      const room = await trx.selectFrom("rooms")
        .selectAll()
        .where("code", "=", roomCode)
        .executeTakeFirst();

      if (!room) throw new Error("Room not found");
      if (room.status !== 'playing') throw new Error("Game is not active");

      // 2. Fetch Player Count
      const playerCountResult = await trx.selectFrom("roomPlayers")
        .select(trx.fn.count("id").as("count"))
        .where("roomId", "=", room.id)
        .executeTakeFirst();
      
      const totalPlayers = Number(playerCountResult?.count ?? 0);
      if (totalPlayers === 0) throw new Error("No players in room");

      // 3. Update Votes
      const currentVotes = room.shuffleVotes || [];
      let newVotes = [...currentVotes];
      
      // Add vote if not already present
      if (!newVotes.includes(playerId)) {
        newVotes.push(playerId);
      }

      const voteCount = newVotes.length;
      const requiredVotes = Math.floor(totalPlayers / 2) + 1; // Majority (> 50%)
      const shouldShuffle = voteCount >= requiredVotes;

      if (shouldShuffle) {
        // 4. Perform Shuffle
        const newLetters = generateRoundLetters();
        
        // Fetch all players in the room
        const players = await trx.selectFrom("roomPlayers")
          .select("playerId")
          .where("roomId", "=", room.id)
          .execute();
        
        const playerIds = players.map(p => p.playerId);

        // Get recent category history for cross-game tracking
        const historyResult = await trx
          .selectFrom("playerCategoryHistory")
          .select("categoryName")
          .where("playerId", "in", playerIds)
          .orderBy("usedAt", "desc")
          .limit(playerIds.length * 50)
          .execute();
        
        const playerCategoryHistories = historyResult.map(h => h.categoryName);
        
        // Pick new mini category using intelligent selection with cross-game tracking
        const newCategory = await selectMiniCategory({
          currentLetters: newLetters,
          usedMiniCategories: [room.currentMiniCategory || ""].filter(Boolean),
          failedMiniCategories: [room.currentMiniCategory || ""].filter(Boolean),
          consecutiveFailures: (room.failedRounds || 0) + 1,
          baseCategory: room.baseCategory || "",
          playerCategoryHistories: playerCategoryHistories,
        });

        await trx.updateTable("rooms")
          .set({
            letters: newLetters,
            currentMiniCategory: newCategory.name,
            shuffleVotes: [], // Reset votes
            roundStartTime: new Date(), // Reset timer
            updatedAt: new Date(),
          })
          .where("id", "=", room.id)
          .execute();

        // Record new category usage for all players
        for (const player of players) {
          await trx.insertInto("playerCategoryHistory")
            .values({
              playerId: player.playerId,
              categoryName: newCategory.name,
              usedAt: new Date(),
            })
            .execute();
        }

        return {
          success: true,
          shuffleTriggered: true,
          currentVotes: 0, // Reset
          requiredVotes,
        };
      } else {
        // Just update the vote count
        await trx.updateTable("rooms")
          .set({
            shuffleVotes: newVotes,
            updatedAt: new Date(),
          })
          .where("id", "=", room.id)
          .execute();

        return {
          success: true,
          shuffleTriggered: false,
          currentVotes: voteCount,
          requiredVotes,
        };
      }
    });

    return new Response(
      superjson.stringify(result satisfies OutputType),
      { status: 200 }
    );

  } catch (error) {
    console.error("Shuffle vote error:", error);
    return new Response(
      superjson.stringify({ 
        success: false, 
        shuffleTriggered: false, 
        currentVotes: 0, 
        requiredVotes: 0, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }), 
      { status: 500 }
    );
  }
}