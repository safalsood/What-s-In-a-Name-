import { Transaction, Selectable } from "kysely";
import { DB, Rooms } from "./schema";
import { generateRoundLetters } from "./gameLogic";
import { selectMiniCategory } from "./categoryManager";
import { trackDeadRound } from "./gameAnalytics";
import { updateMiniCategoriesSeen } from "./gameSessionStats";

/**
 * Handles round timeout logic when no player submits a valid word in time.
 * Selects new category/letters based on failure count, tracks analytics, and restarts round.
 * 
 * @returns Updated room if timeout occurred, otherwise original room
 */
export async function handleRoundTimeout(
  trx: Transaction<DB>,
  room: Selectable<Rooms>,
  roomCode: string
): Promise<Selectable<Rooms>> {
  if (room.status !== 'playing' || !room.roundStartTime || room.roundWinnerId) {
    return room;
  }

  // Lock the room row to prevent concurrent modifications
  const lockedRoom = await trx.selectFrom("rooms")
    .selectAll()
    .where("id", "=", room.id)
    .forUpdate()
    .executeTakeFirstOrThrow();
  
  // Re-check conditions with locked data - another transaction might have already handled timeout
  if (lockedRoom.status !== 'playing' || !lockedRoom.roundStartTime || lockedRoom.roundWinnerId) {
    console.log(`Room ${roomCode}: Timeout conditions no longer met after lock, skipping`);
    return lockedRoom;
  }

  const now = new Date();
  const elapsed = now.getTime() - new Date(lockedRoom.roundStartTime).getTime();
  const ROUND_DURATION = 60 * 1000; // 60 seconds

  if (elapsed <= ROUND_DURATION) {
    return lockedRoom;
  }

  // Track dead round for analytics
  const oldMiniCategory = lockedRoom.currentMiniCategory;
  if (lockedRoom.currentMiniCategory) {
    await trackDeadRound({ category: lockedRoom.currentMiniCategory });
  }
  
  // Round failed (timeout) - match solo mode behavior
  const newFailedRounds = lockedRoom.failedRounds + 1;
  let newLetters = lockedRoom.letters || [];
  let shouldResetFailureCount = false;

  // After 3 failed rounds: regenerate letters only (base category stays locked!)
  if (newFailedRounds >= 3) {
    console.log(`Room ${roomCode}: 3 failed rounds, regenerating letters`);
    shouldResetFailureCount = true;
    newLetters = generateRoundLetters();
  }

  // Get used mini category IDs to prevent repetition
  const usedMiniCategoryIds = lockedRoom.usedMiniCategoryIds || [];

  // Select new mini category intelligently using categoryManager
  // Base category NEVER changes - it's locked for the entire match
  const miniCatItem = await selectMiniCategory({
    currentLetters: newLetters,
    usedMiniCategories: usedMiniCategoryIds,
    failedMiniCategories: [], // Simplified for timeout recovery
    consecutiveFailures: shouldResetFailureCount ? 0 : newFailedRounds,
    baseCategory: lockedRoom.baseCategory || "", // Base category stays locked!
    playerCategoryHistories: [] // No cross-game tracking in multiplayer timeout
  });

  console.log(`Room ${roomCode}: Timeout - changing mini category from "${oldMiniCategory}" to "${miniCatItem.name}" (reason: timeout, failures: ${newFailedRounds})`);

  // Add selected mini category ID to used list
  const updatedUsedMiniCategoryIds = [...usedMiniCategoryIds, miniCatItem.id];

  const updatedRoom = await trx.updateTable("rooms")
    .set({
      failedRounds: shouldResetFailureCount ? 0 : newFailedRounds,
      letters: newLetters,
      // Base category is NOT updated - stays locked for entire match
      currentMiniCategory: miniCatItem.name,
      roundStartTime: new Date(), // Restart timer
      usedMiniCategoryIds: updatedUsedMiniCategoryIds,
      updatedAt: new Date(),
    })
    .where("id", "=", lockedRoom.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  // Record round history with new letters and category (same round number, restarted)
  await trx.insertInto("roundHistory")
    .values({
      roomId: lockedRoom.id,
      roundNumber: lockedRoom.roundNumber,
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

  // Update mini categories seen for all players after timeout (fire-and-forget)
  const timeoutPlayers = await trx.selectFrom("roomPlayers")
    .selectAll()
    .where("roomId", "=", lockedRoom.id)
    .execute();
  
  for (const p of timeoutPlayers) {
    updateMiniCategoriesSeen(lockedRoom.id, p.playerId, updatedUsedMiniCategoryIds.length)
      .catch(err => console.error('[GameSessionStats] Error updating mini categories:', err));
  }

  return updatedRoom;
}