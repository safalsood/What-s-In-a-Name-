import { Transaction, Selectable } from "kysely";
import { DB, Rooms } from "./schema";
import { generateRoundLetters } from "./gameLogic";
import { selectBaseCategoryForPlayers, selectMiniCategory } from "./categoryManager";

export interface StartGameRoundOptions {
  roomId: number;
  room: Selectable<Rooms>;
  isFirstRound?: boolean; // true if starting from waiting, false if advancing
  skipToPlaying?: boolean; // true to skip tutorial phase and go directly to playing (defaults to false)
}

/**
 * Shared logic for starting or advancing a game round.
 * Used by both manual start endpoint and auto-start logic.
 * 
 * @param trx - Kysely transaction
 * @param options - Room and round configuration
 * @returns void - updates room state in database
 */
export async function startGameRound(
  trx: Transaction<DB>,
  options: StartGameRoundOptions
): Promise<void> {
  const { roomId, room, isFirstRound = false, skipToPlaying = false } = options;

  // Get all players in the room
  const players = await trx.selectFrom("roomPlayers")
    .selectAll()
    .where("roomId", "=", roomId)
    .execute();
  
  if (players.length < room.minPlayers) {
    throw new Error(`Need at least ${room.minPlayers} players`);
  }

  const playerIds = players.map(p => p.playerId);

  // Determine current game number for category tracking
  let currentGameNumber = 1; // Default for first game ever
  
  // Get max game_number across all players to determine current game number
  const maxGameResult = await trx
    .selectFrom("playerCategoryHistory")
    .select((eb) => eb.fn.max("gameNumber").as("maxGame"))
    .where("playerId", "in", playerIds)
    .executeTakeFirst();
  
  const maxGameNumber = maxGameResult?.maxGame || 0;
  
  if (isFirstRound) {
    // Starting a NEW game - increment game number
    currentGameNumber = maxGameNumber + 1;
  } else {
    // Continuing same game - use current game number
    currentGameNumber = maxGameNumber > 0 ? maxGameNumber : 1;
  }

  // Get recent category history for all players from LAST 5 GAMES ONLY
  // This implements the 5-game cooldown: categories from game 6+ ago can be reused
  const fiveGamesAgo = currentGameNumber - 5;
  
  const usedCategoriesResult = await trx
    .selectFrom("playerCategoryHistory")
    .select("categoryName")
    .where("playerId", "in", playerIds)
    .where("gameNumber", ">", fiveGamesAgo)
    .execute();

  const usedCategoryNames = usedCategoriesResult.map(c => c.categoryName);

  // Generate round letters
  const letters = generateRoundLetters();
  
  // Select base category (only if not already set - LOCKED for entire match)
  let baseCategoryName = room.baseCategory;
  let isNewBaseCategory = false;
  if (!baseCategoryName) {
    const selectedBase = await selectBaseCategoryForPlayers(usedCategoryNames);
    baseCategoryName = selectedBase.name;
    isNewBaseCategory = true;
  }

  // Get used mini category IDs from room to prevent repetition within match
  const usedMiniCategoryIds = room.usedMiniCategoryIds || [];

  // Select mini category using intelligent categoryManager
  const selectedMiniCategory = await selectMiniCategory({
    currentLetters: letters,
    usedMiniCategories: usedMiniCategoryIds,
    failedMiniCategories: [],
    consecutiveFailures: 0,
    baseCategory: baseCategoryName!,
    playerCategoryHistories: usedCategoryNames,
  });
  const miniCategoryName = selectedMiniCategory.name;
  const miniCategoryId = selectedMiniCategory.id;

  // Add selected mini category ID to used list
  const updatedUsedMiniCategoryIds = [...usedMiniCategoryIds, miniCategoryId];

  // Record category usage for all players with proper game number
  const categoriesToRecord: Array<{ name: string; isBase: boolean }> = [
    { name: miniCategoryName, isBase: false }
  ];
  
  // Only record base category if it's new (first round of match)
  if (isNewBaseCategory && baseCategoryName) {
    categoriesToRecord.push({ name: baseCategoryName, isBase: true });
  }

  for (const player of players) {
    for (const category of categoriesToRecord) {
      // Check if already recorded for this game number
      const existing = await trx
        .selectFrom("playerCategoryHistory")
        .select("id")
        .where("playerId", "=", player.playerId)
        .where("categoryName", "=", category.name)
        .where("gameNumber", "=", currentGameNumber)
        .executeTakeFirst();

      if (!existing) {
        await trx.insertInto("playerCategoryHistory")
          .values({
            playerId: player.playerId,
            playerName: player.playerName,
            categoryName: category.name,
            gameNumber: currentGameNumber,
            isBaseCategory: category.isBase,
            usedAt: new Date(),
          })
          .execute();
      }
    }
  }

  // Determine next round number
  const nextRound = isFirstRound ? 1 : room.roundNumber + 1;

  // Determine status and roundStartTime based on tutorial requirements
  const shouldGoToTutorial = isFirstRound && !skipToPlaying;
  const newStatus = shouldGoToTutorial ? 'tutorial' : 'playing';
  const newRoundStartTime = shouldGoToTutorial ? null : new Date();

  // Update room state
  await trx.updateTable("rooms")
    .set({
      status: newStatus,
      roundNumber: nextRound,
      roundStartTime: newRoundStartTime,
      baseCategory: baseCategoryName,
      currentMiniCategory: miniCategoryName,
      letters: letters,
      roundWinnerId: null,
      roundWinningWord: null,
      failedRounds: 0,
      shuffleVotes: [],
      usedMiniCategoryIds: updatedUsedMiniCategoryIds,
      updatedAt: new Date(),
    })
    .where("id", "=", roomId)
    .execute();

  // Record round history with letters and mini category
  await trx.insertInto("roundHistory")
    .values({
      roomId: roomId,
      roundNumber: nextRound,
      letters: letters,
      miniCategory: miniCategoryName,
    })
    .onConflict((oc) => oc
      .columns(["roomId", "roundNumber"])
      .doUpdateSet({
        letters: letters,
        miniCategory: miniCategoryName,
      })
    )
    .execute();
}