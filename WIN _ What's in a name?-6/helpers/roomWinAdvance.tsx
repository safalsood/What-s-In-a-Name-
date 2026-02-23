import { Transaction, Selectable } from "kysely";
import { DB, Rooms } from "./schema";
import { generateRoundLetters, TOUGH_LETTERS } from "./gameLogic";
import { selectMiniCategory } from "./categoryManager";
import { updateMiniCategoriesSeen } from "./gameSessionStats";

/**
 * Handles automatic round advancement after a win.
 * Checks timing conditions, generates new letters/category, and advances the round.
 * 
 * @returns Updated room if advancement occurred, otherwise original room
 */
export async function handleWinAdvance(
  trx: Transaction<DB>,
  room: Selectable<Rooms>,
  roomCode: string
): Promise<Selectable<Rooms>> {
  if (room.status !== 'playing' || !room.roundWinnerId) {
    return room;
  }

  // Lock the room row to prevent concurrent modifications
  const lockedRoom = await trx.selectFrom("rooms")
    .selectAll()
    .where("id", "=", room.id)
    .forUpdate()
    .executeTakeFirstOrThrow();
  
  // Re-check conditions with locked data - another transaction might have already advanced
  if (lockedRoom.status !== 'playing' || !lockedRoom.roundWinnerId) {
    console.log(`Room ${roomCode}: Win-advance conditions no longer met after lock, skipping`);
    return lockedRoom;
  }

  const now = new Date();
  const timeSinceWin = now.getTime() - new Date(lockedRoom.updatedAt).getTime();
  const WIN_OVERLAY_DURATION = 3 * 1000; // 3 seconds for overlay display
  const BONUS_SAFETY_TIMEOUT = 18 * 1000; // 18 seconds total (3s overlay + 15s bonus time)

  // Check if winner used a tough letter
  const winningWord = lockedRoom.roundWinningWord || "";
  const firstLetter = winningWord.charAt(0).toUpperCase();
  const usedToughLetter = TOUGH_LETTERS.includes(firstLetter);

  let canAdvance = false;

  if (!usedToughLetter) {
    // No tough letter - advance after overlay duration
    canAdvance = timeSinceWin >= WIN_OVERLAY_DURATION;
  } else {
    // Tough letter used - check if bonus word was submitted or safety timeout elapsed
    if (timeSinceWin >= BONUS_SAFETY_TIMEOUT) {
      // Safety timeout elapsed - advance regardless
      canAdvance = true;
      console.log(`Room ${roomCode}: Safety timeout elapsed, auto-advancing despite bonus not submitted`);
    } else if (timeSinceWin >= WIN_OVERLAY_DURATION) {
      // Check if winner has submitted 2 words this round
      const winnerWordCount = await trx
        .selectFrom("usedWords")
        .select(trx.fn.count("id").as("count"))
        .where("roomId", "=", lockedRoom.id)
        .where("roundNumber", "=", lockedRoom.roundNumber)
        .where("playerId", "=", lockedRoom.roundWinnerId)
        .executeTakeFirst();

      const wordCount = Number(winnerWordCount?.count || 0);
      if (wordCount >= 2) {
        // Bonus word submitted - can advance
        canAdvance = true;
        console.log(`Room ${roomCode}: Winner submitted bonus word, auto-advancing`);
      }
    }
  }

  if (!canAdvance) {
    return lockedRoom;
  }

  // Advance to next round
  const oldMiniCategory = lockedRoom.currentMiniCategory;
  console.log(`Room ${roomCode}: Auto-advancing to round ${lockedRoom.roundNumber + 1} after win`);

  // Generate new letters
  const newLetters = generateRoundLetters();

  // Get all players for category history
  const players = await trx.selectFrom("roomPlayers")
    .selectAll()
    .where("roomId", "=", lockedRoom.id)
    .execute();

  // Get used mini category IDs to prevent repetition
  const usedMiniCategoryIds = lockedRoom.usedMiniCategoryIds || [];

  // Select new mini category intelligently
  const miniCatItem = await selectMiniCategory({
    currentLetters: newLetters,
    usedMiniCategories: usedMiniCategoryIds,
    failedMiniCategories: [],
    consecutiveFailures: 0, // Reset on successful round
    baseCategory: lockedRoom.baseCategory || "", // Base category stays locked!
    playerCategoryHistories: [] // Could add cross-game tracking if needed
  });

  console.log(`Room ${roomCode}: New round ${lockedRoom.roundNumber + 1} - changing mini category from "${oldMiniCategory}" to "${miniCatItem.name}" (reason: win-advance)`);

  // Add selected mini category ID to used list
  const updatedUsedMiniCategoryIds = [...usedMiniCategoryIds, miniCatItem.id];

  const nextRoundNumber = lockedRoom.roundNumber + 1;

  const updatedRoom = await trx.updateTable("rooms")
    .set({
      roundNumber: nextRoundNumber,
      letters: newLetters,
      currentMiniCategory: miniCatItem.name,
      roundWinnerId: null,
      roundWinningWord: null,
      roundStartTime: new Date(),
      failedRounds: 0,
      shuffleVotes: [],
      usedMiniCategoryIds: updatedUsedMiniCategoryIds,
      updatedAt: new Date(),
    })
    .where("id", "=", lockedRoom.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  // Record round history with new letters and category
  await trx.insertInto("roundHistory")
    .values({
      roomId: lockedRoom.id,
      roundNumber: nextRoundNumber,
      letters: newLetters,
      miniCategory: miniCatItem.name,
    })
    .onConflict((oc) => oc
      .columns(["roomId", "roundNumber"])
      .doUpdateSet({
        letters: newLetters,
        miniCategory: miniCatItem.name,
      })
    )
    .execute();

  // Update mini categories seen for all players (fire-and-forget)
  for (const p of players) {
    updateMiniCategoriesSeen(lockedRoom.id, p.playerId, nextRoundNumber)
      .catch(err => console.error('[GameSessionStats] Error updating mini categories:', err));
  }

  return updatedRoom;
}