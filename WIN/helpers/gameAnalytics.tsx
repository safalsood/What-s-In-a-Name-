import { db } from "./db";
import { sql } from "kysely";
import { checkAndSyncToSheet } from "./googleSheetsWordStats";

/**
 * Records every word submission attempt to the database and updates category statistics.
 * This function handles both the raw submission log and the aggregated stats.
 */
export async function trackWordSubmission({
  playerId,
  playerName,
  roomId,
  word,
  category,
  isBaseCategory,
  isValid,
  fitsCategory,
}: {
  playerId: string;
  playerName?: string;
  roomId?: number;
  word: string;
  category: string;
  isBaseCategory: boolean;
  isValid: boolean;
  fitsCategory: boolean;
}) {
  try {
    // 1. Insert into word_submissions
    await db
      .insertInto("wordSubmissions")
      .values({
        playerId,
        playerName: playerName ?? null,
        roomId: roomId ?? null,
        word,
        category,
        isBaseCategory,
        isValid,
        fitsCategory,
        createdAt: new Date(),
      })
      .execute();

    // 2. Update category_stats
    // We use a "Update first, then Insert" strategy to handle potential race conditions
    // without relying on specific unique constraints being present/named correctly.
    const isSuccess = isValid && fitsCategory;

    const updateResult = await db
      .updateTable("categoryStats")
      .set((eb) => ({
        totalAttempts: eb("totalAttempts", "+", 1),
        successfulAttempts: eb(
          "successfulAttempts",
          "+",
          isSuccess ? 1 : 0
        ),
        updatedAt: new Date(),
      }))
      .where("categoryName", "=", category)
      .executeTakeFirst();

    // If no row was updated, it means the category stats don't exist yet.
    if (Number(updateResult.numUpdatedRows) === 0) {
      try {
        await db
          .insertInto("categoryStats")
          .values({
            categoryName: category,
            totalAttempts: 1,
            successfulAttempts: isSuccess ? 1 : 0,
            updatedAt: new Date(),
          })
          .execute();
      } catch (insertError) {
        // If insert fails, it's likely a race condition where another request created it.
        // We can try updating one more time or just ignore it as stats will be slightly off (acceptable for analytics).
        console.warn(
          `[GameAnalytics] Race condition detected for category stats: ${category}`,
          insertError
        );
        
        // Retry update once just in case
        await db
          .updateTable("categoryStats")
          .set((eb) => ({
            totalAttempts: eb("totalAttempts", "+", 1),
            successfulAttempts: eb(
              "successfulAttempts",
              "+",
              isSuccess ? 1 : 0
            ),
            updatedAt: new Date(),
          }))
          .where("categoryName", "=", category)
          .execute();
      }
    }

        // Track for Google Sheets sync if word was accepted
    if (isSuccess) {
      // Fire-and-forget: Update word category stats and potentially sync to Google Sheets
      checkAndSyncToSheet(playerId, word.toLowerCase(), category).catch(
        (err: unknown) =>
          console.error(
            "[GameAnalytics] Failed to update word category stats:",
            err
          )
      );
    }
  } catch (error) {
    console.error("[GameAnalytics] Failed to track word submission:", error);
  }
}

/**
 * Records category usage for cross-game repetition tracking.
 */
export async function trackCategoryUsage({
  playerId,
  playerName,
  categoryName,
  isBaseCategory,
}: {
  playerId: string;
  playerName?: string;
  categoryName: string;
  isBaseCategory: boolean;
}) {
  try {
    await db
      .insertInto("playerCategoryHistory")
      .values({
        playerId,
        playerName: playerName ?? null,
        categoryName,
        isBaseCategory,
        usedAt: new Date(),
      })
      .execute();
  } catch (error) {
    console.error("[GameAnalytics] Failed to track category usage:", error);
  }
}

/**
 * Gets most commonly used (successful) words for a category.
 */
export async function getPopularWordsForCategory(
  category: string,
  limit: number = 10
): Promise<{ word: string; count: number }[]> {
  try {
    const results = await db
      .selectFrom("wordSubmissions")
      .select([
        "word",
        // Cast count to string because Postgres returns bigint for count
        sql<string>`count(id)`.as("count"),
      ])
      .where("category", "=", category)
      .where("isValid", "=", true)
      .where("fitsCategory", "=", true)
      .groupBy("word")
      .orderBy("count", "desc")
      .limit(limit)
      .execute();

    return results.map((r) => ({
      word: r.word,
      count: Number(r.count),
    }));
  } catch (error) {
    console.error(
      "[GameAnalytics] Failed to get popular words for category:",
      error
    );
    return [];
  }
}

/**
 * Gets the success rate for a category.
 * Returns null if no data exists.
 */
export async function getCategorySuccessRate(
  categoryName: string
): Promise<{
  totalAttempts: number;
  successfulAttempts: number;
  successRate: number;
} | null> {
  try {
    // We sum up the stats to be robust against potential duplicate rows
    const result = await db
      .selectFrom("categoryStats")
      .select([
        sql<string>`sum(total_attempts)`.as("total"),
        sql<string>`sum(successful_attempts)`.as("successful"),
      ])
      .where("categoryName", "=", categoryName)
      .executeTakeFirst();

    if (!result || !result.total) {
      return null;
    }

    const total = Number(result.total);
    const successful = Number(result.successful);

    if (total === 0) return null;

    return {
      totalAttempts: total,
      successfulAttempts: successful,
      successRate: successful / total,
    };
  } catch (error) {
    console.error(
      "[GameAnalytics] Failed to get category success rate:",
      error
    );
    return null;
  }
}

/**
 * Tracks a dead round (no valid submissions) for a category.
 * Updates the category_stats table using optimistic update strategy.
 */
export async function trackDeadRound({
  category,
}: {
  category: string;
}) {
  try {
    const updateResult = await db
      .updateTable("categoryStats")
      .set((eb) => ({
        deadRounds: eb("deadRounds", "+", 1),
        updatedAt: new Date(),
      }))
      .where("categoryName", "=", category)
      .executeTakeFirst();

    // If no row was updated, insert a new one
    if (Number(updateResult.numUpdatedRows) === 0) {
      try {
        await db
          .insertInto("categoryStats")
          .values({
            categoryName: category,
            totalAttempts: 0,
            successfulAttempts: 0,
            deadRounds: 1,
            updatedAt: new Date(),
          })
          .execute();
      } catch (insertError) {
        // Race condition - retry update
        console.warn(
          `[GameAnalytics] Race condition detected for dead round tracking: ${category}`,
          insertError
        );
        
        await db
          .updateTable("categoryStats")
          .set((eb) => ({
            deadRounds: eb("deadRounds", "+", 1),
            updatedAt: new Date(),
          }))
          .where("categoryName", "=", category)
          .execute();
      }
    }
  } catch (error) {
    console.error("[GameAnalytics] Failed to track dead round:", error);
  }
}

/**
 * Gets the dead round count and rate for a category.
 * Returns null if no data exists.
 */
export async function getCategoryDeadRoundRate(
  categoryName: string
): Promise<{
  deadRounds: number;
  totalAttempts: number;
  deadRoundRate: number;
} | null> {
  try {
    const result = await db
      .selectFrom("categoryStats")
      .select([
        sql<string>`sum(dead_rounds)`.as("deadRounds"),
        sql<string>`sum(total_attempts)`.as("totalAttempts"),
      ])
      .where("categoryName", "=", categoryName)
      .executeTakeFirst();

    if (!result || (!result.deadRounds && !result.totalAttempts)) {
      return null;
    }

    const deadRounds = Number(result.deadRounds || 0);
    const totalAttempts = Number(result.totalAttempts || 0);
    const totalEvents = deadRounds + totalAttempts;

    if (totalEvents === 0) return null;

    return {
      deadRounds,
      totalAttempts,
      deadRoundRate: deadRounds / totalEvents,
    };
  } catch (error) {
    console.error(
      "[GameAnalytics] Failed to get category dead round rate:",
      error
    );
    return null;
  }
}

/**
 * Returns a difficulty score (1-10) based on success rate and dead round rate.
 * Higher success rate = lower difficulty (easier).
 * Higher dead round rate = higher difficulty (harder).
 * 1 = Very Easy (100% success, no dead rounds), 10 = Very Hard (0% success, many dead rounds).
 * Returns default of 5 if no data.
 */
export async function getCategoryDifficultyScore(
  categoryName: string
): Promise<number> {
  try {
    const stats = await getCategorySuccessRate(categoryName);
    const deadRoundStats = await getCategoryDeadRoundRate(categoryName);

    if (!stats && !deadRoundStats) {
      return 5; // Default medium difficulty
    }

    // Base difficulty from success rate (1-10 scale)
    // Formula: 1 + (1 - successRate) * 9
    let baseScore = 5;
    if (stats) {
      baseScore = 1 + (1 - stats.successRate) * 9;
    }

    // Dead round penalty (adds up to 3 points)
    let deadRoundPenalty = 0;
    if (deadRoundStats) {
      const totalEvents = deadRoundStats.deadRounds + deadRoundStats.totalAttempts;
      deadRoundPenalty = (deadRoundStats.deadRounds / (totalEvents + 1)) * 3;
    }

    const finalScore = baseScore + deadRoundPenalty;
    
    // Clamp between 1-10
    return Math.round(Math.max(1, Math.min(10, finalScore)));
  } catch (error) {
    console.error(
      "[GameAnalytics] Failed to get category difficulty score:",
      error
    );
    return 5;
  }
}

/**
 * Gets categories a player has seen in last N games.
 */
export async function getPlayerRecentCategories(
  playerId: string,
  gameCount: number = 5,
  isBaseCategory?: boolean
): Promise<string[]> {
  try {
    let query = db
      .selectFrom("playerCategoryHistory")
      .select("categoryName")
      .where("playerId", "=", playerId)
      .orderBy("usedAt", "desc")
      .limit(gameCount);

    if (isBaseCategory !== undefined) {
      query = query.where("isBaseCategory", "=", isBaseCategory);
    }

    const results = await query.execute();
    return results.map((r) => r.categoryName);
  } catch (error) {
    console.error(
      "[GameAnalytics] Failed to get player recent categories:",
      error
    );
    return [];
  }
}