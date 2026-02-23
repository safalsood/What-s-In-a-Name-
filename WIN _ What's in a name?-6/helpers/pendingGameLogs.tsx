import { db } from "./db";
import { LogRoundDataParams, logRoundDataToSheet } from "./googleSheetsRoundData";
import { trackWordSubmission } from "./gameAnalytics";
import { checkAndSyncToSheet } from "./googleSheetsWordStats";

// --- Types ---

export type WordSubmissionParams = {
  playerId: string;
  playerName?: string;
  roomId?: number;
  word: string;
  category: string;
  isBaseCategory: boolean;
  isValid: boolean;
  fitsCategory: boolean;
};

export type WordStatsParams = {
  playerId: string;
  word: string;
  category: string;
};

const LOG_TYPE = {
  ROUND_DATA: "roundData",
  WORD_SUBMISSION: "wordSubmission",
  WORD_STATS: "wordStats",
} as const;

// --- Public Functions ---

/**
 * Queue a log entry for Google Sheets round data.
 * Instead of calling logRoundDataToSheet immediately, stores it in DB.
 */
export async function queueRoundDataLog(roomId: number, params: LogRoundDataParams) {
  try {
    await db
      .insertInto("pendingGameLogs")
      .values({
        roomId,
        logType: LOG_TYPE.ROUND_DATA,
        logData: JSON.stringify(params),
        createdAt: new Date(),
      })
      .execute();
  } catch (error) {
    console.error("[PendingLogs] Failed to queue round data log:", error);
  }
}

/**
 * Queue a log entry for word submission analytics.
 * Instead of calling trackWordSubmission immediately, stores it in DB.
 */
export async function queueWordSubmissionLog(roomId: number, params: WordSubmissionParams) {
  try {
    await db
      .insertInto("pendingGameLogs")
      .values({
        roomId,
        logType: LOG_TYPE.WORD_SUBMISSION,
        logData: JSON.stringify(params),
        createdAt: new Date(),
      })
      .execute();
  } catch (error) {
    console.error("[PendingLogs] Failed to queue word submission log:", error);
  }
}

/**
 * Queue a log entry for word category stats sync.
 * Instead of calling checkAndSyncToSheet immediately, stores it in DB.
 */
export async function queueWordStatsLog(roomId: number, params: WordStatsParams) {
  try {
    await db
      .insertInto("pendingGameLogs")
      .values({
        roomId,
        logType: LOG_TYPE.WORD_STATS,
        logData: JSON.stringify(params),
        createdAt: new Date(),
      })
      .execute();
  } catch (error) {
    console.error("[PendingLogs] Failed to queue word stats log:", error);
  }
}

/**
 * Process all pending logs for a room.
 * Fetches logs, executes the corresponding helper functions, and deletes processed logs.
 * Returns the number of logs successfully processed.
 */
export async function flushPendingLogs(roomId: number): Promise<number> {
  try {
    // 1. Fetch all pending logs for the room
    const logs = await db
      .selectFrom("pendingGameLogs")
      .selectAll()
      .where("roomId", "=", roomId)
      .execute();

    if (logs.length === 0) {
      return 0;
    }

    console.log(`[PendingLogs] Flushing ${logs.length} logs for room ${roomId}...`);

    const processedIds: number[] = [];

    // 2. Process logs sequentially to avoid overwhelming external APIs (like Google Sheets)
    // We could do Promise.all, but sequential is safer for rate limits.
    for (const log of logs) {
      try {
        const data = typeof log.logData === 'string' 
          ? JSON.parse(log.logData) 
          : log.logData;

        switch (log.logType) {
          case LOG_TYPE.ROUND_DATA:
            await logRoundDataToSheet(data as LogRoundDataParams);
            break;
          case LOG_TYPE.WORD_SUBMISSION:
            await trackWordSubmission(data as WordSubmissionParams);
            break;
          case LOG_TYPE.WORD_STATS:
            const statsParams = data as WordStatsParams;
            await checkAndSyncToSheet(
              statsParams.playerId,
              statsParams.word,
              statsParams.category
            );
            break;
          default:
            console.warn(`[PendingLogs] Unknown log type: ${log.logType}`);
        }
        
        processedIds.push(log.id);
      } catch (err) {
        console.error(`[PendingLogs] Failed to process log ${log.id} (${log.logType}):`, err);
        // We continue processing other logs even if one fails
      }
    }

    // 3. Delete successfully processed logs
    if (processedIds.length > 0) {
      await db
        .deleteFrom("pendingGameLogs")
        .where("id", "in", processedIds)
        .execute();
    }

    console.log(`[PendingLogs] Successfully flushed ${processedIds.length}/${logs.length} logs for room ${roomId}`);
    return processedIds.length;

  } catch (error) {
    console.error(`[PendingLogs] Error flushing logs for room ${roomId}:`, error);
    return 0;
  }
}