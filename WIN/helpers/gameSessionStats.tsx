import { db } from "./db";
import { sql } from "kysely";
import crypto from "crypto";

// --- Constants ---

const SHEET_ID = "1lUqqVvK73FgxV1_l01GjsiccxsDfFgFYzDmFxJmZlj8";
const SHEET_NAME = "GAME_SESSION_STATS";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

// --- Helper Functions ---

function formatSecondsToMMSS(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const pad = (num: number) => num.toString().padStart(2, "0");
  return `${pad(minutes)}:${pad(seconds)}`;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// --- Types ---

export interface InitGameSessionParams {
  roomId?: number | null;
  soloSessionId?: string | null;
  playerId: string;
  playerUsername?: string | null;
  gameMode: string;
  gameStartTime: Date;
  miniCategoriesSeen: number;
  playersCount: number;
}

export interface FinalizeGameSessionParams {
  finalLetterCount: number;
  result: "Win" | "Loss" | "Quit";
  totalRounds: number;
  finalGrandWordSubmitted?: string;
  possibleGrandWordShown?: string;
}

// --- Database Tracking Functions ---

/**
 * Initializes a game session record in the database.
 * Call this when the multiplayer room state becomes 'playing' or a solo game starts.
 */
export async function initGameSession(params: InitGameSessionParams) {
  try {
    let query = db
      .insertInto("gameSessionStats")
      .values({
        roomId: params.roomId ?? null,
        soloSessionId: params.soloSessionId ?? null,
        playerId: params.playerId,
        playerUsername: params.playerUsername ?? null,
        gameMode: params.gameMode,
        gameStartTime: params.gameStartTime,
        miniCategoriesSeen: params.miniCategoriesSeen,
        playersCount: params.playersCount,
        grandAttemptCount: 0,
        syncedToSheets: false,
        updatedAt: new Date(),
      });

    // Only apply conflict resolution for multiplayer (where roomId is present)
    // as we rely on (roomId, playerId) uniqueness.
    // For solo, we rely on the caller generating a unique soloSessionId or DB constraints.
    if (params.roomId) {
      query = query.onConflict((oc) =>
        oc.columns(["roomId", "playerId"]).doNothing()
      );
    }

    await query.execute();
  } catch (error) {
    console.error("[GameSessionStats] Error initializing session:", error);
  }
}

/**
 * Records the first grand attempt time, letter count, and rounds before attempt.
 * Idempotent: Only updates if first_grand_attempt_time is currently NULL.
 * Accepts either roomId (number) for multiplayer or soloSessionId (string) for solo.
 */
export async function trackFirstGrandAttempt(
  roomIdOrSoloId: number | string,
  playerId: string,
  currentLetterCount: number,
  roundsBeforeFirstGrandAttempt: number
) {
  try {
    let query = db
      .updateTable("gameSessionStats")
      .set({
        firstGrandAttemptTime: new Date(),
        lettersAtFirstGrandAttempt: currentLetterCount,
        roundsBeforeFirstGrandAttempt: roundsBeforeFirstGrandAttempt,
        updatedAt: new Date(),
      })
      .where("firstGrandAttemptTime", "is", null);

    if (typeof roomIdOrSoloId === "number") {
      query = query
        .where("roomId", "=", roomIdOrSoloId)
        .where("playerId", "=", playerId);
    } else {
      query = query.where("soloSessionId", "=", roomIdOrSoloId);
    }

    await query.execute();
  } catch (error) {
    console.error(
      "[GameSessionStats] Error tracking first grand attempt:",
      error
    );
  }
}

/**
 * Increments the grand attempt counter for a player.
 * Accepts either roomId (number) for multiplayer or soloSessionId (string) for solo.
 */
export async function incrementGrandAttemptCount(
  roomIdOrSoloId: number | string,
  playerId: string
) {
  try {
    let query = db.updateTable("gameSessionStats").set((eb) => ({
      grandAttemptCount: sql`grand_attempt_count + 1`,
      updatedAt: new Date(),
    }));

    if (typeof roomIdOrSoloId === "number") {
      query = query
        .where("roomId", "=", roomIdOrSoloId)
        .where("playerId", "=", playerId);
    } else {
      query = query.where("soloSessionId", "=", roomIdOrSoloId);
    }

    await query.execute();
  } catch (error) {
    console.error(
      "[GameSessionStats] Error incrementing grand attempt count:",
      error
    );
  }
}

/**
 * Updates the count of mini categories seen by the player.
 * Accepts either roomId (number) for multiplayer or soloSessionId (string) for solo.
 */
export async function updateMiniCategoriesSeen(
  roomIdOrSoloId: number | string,
  playerId: string,
  count: number
) {
  try {
    let query = db.updateTable("gameSessionStats").set({
      miniCategoriesSeen: count,
      updatedAt: new Date(),
    });

    if (typeof roomIdOrSoloId === "number") {
      query = query
        .where("roomId", "=", roomIdOrSoloId)
        .where("playerId", "=", playerId);
    } else {
      query = query.where("soloSessionId", "=", roomIdOrSoloId);
    }

    await query.execute();
  } catch (error) {
    console.error(
      "[GameSessionStats] Error updating mini categories seen:",
      error
    );
  }
}

/**
 * Finalizes the game session stats when the game ends.
 * Sets the end time, total letters collected, result, and other final stats.
 * Accepts either roomId (number) for multiplayer or soloSessionId (string) for solo.
 */
export async function finalizeGameSession(
  roomIdOrSoloId: number | string,
  playerId: string,
  params: FinalizeGameSessionParams
) {
  try {
    let query = db.updateTable("gameSessionStats").set({
      gameEndTime: new Date(),
      totalLettersCollected: params.finalLetterCount,
      result: params.result,
      totalRounds: params.totalRounds,
      finalGrandWordSubmitted: params.finalGrandWordSubmitted ?? null,
      possibleGrandWordShown: params.possibleGrandWordShown ?? null,
      winningGrandAttempt: params.result === "Win",
      updatedAt: new Date(),
    });

    if (typeof roomIdOrSoloId === "number") {
      query = query
        .where("roomId", "=", roomIdOrSoloId)
        .where("playerId", "=", playerId);
    } else {
      query = query.where("soloSessionId", "=", roomIdOrSoloId);
    }

    await query.execute();
  } catch (error) {
    console.error("[GameSessionStats] Error finalizing game session:", error);
  }
}

// --- Google Sheets Logging Functions ---

/**
 * Shared logic to upload formatted stats to Google Sheets and mark them as synced.
 * New format: 16 columns (A:P)
 */
async function processAndUploadStats(
  stats: {
    id: number;
    roomCode: string | null;
    soloSessionId: string | null;
    playerId: string;
    playerUsername: string | null;
    gameMode: string;
    gameStartTime: Date;
    gameEndTime: Date | null;
    firstGrandAttemptTime: Date | null;
    miniCategoriesSeen: number;
    grandAttemptCount: number;
    lettersAtFirstGrandAttempt: number | null;
    totalLettersCollected: number;
    playersCount: number;
    totalRounds: number;
    roundsBeforeFirstGrandAttempt: number | null;
    result: string | null;
    finalGrandWordSubmitted: string | null;
    possibleGrandWordShown: string | null;
  }[]
) {
  if (stats.length === 0) return;

  // Prepare rows for Google Sheets - 16 columns
  const rows = stats.map((stat) => {
    const startTime = new Date(stat.gameStartTime);
    const endTime = stat.gameEndTime ? new Date(stat.gameEndTime) : null;
    const firstGrandTime = stat.firstGrandAttemptTime
      ? new Date(stat.firstGrandAttemptTime)
      : null;

    // 1. Date (YYYY-MM-DD)
    const date = formatDate(startTime);

    // 2. Game_ID
    const gameId = stat.roomCode ?? stat.soloSessionId ?? "UNKNOWN";

    // 3. Username
    const username = stat.playerUsername || stat.playerId;

    // 4. Mode
    const mode = stat.gameMode === "solo" ? "Solo" : "Multiplayer";

    // 5. Players_Count
    const playersCount = stat.playersCount;

    // 6. Game_Duration (mm:ss)
    const gameDurationSec = endTime
      ? Math.round((endTime.getTime() - startTime.getTime()) / 1000)
      : 0;
    const gameDuration = formatSecondsToMMSS(gameDurationSec);

    // 7. Total_Rounds
    const totalRounds = stat.totalRounds;

    // 8. Mini_Categories_Completed
    const miniCategoriesCompleted = stat.miniCategoriesSeen;

    // 9. First_Grand_Attempt_Time (mm:ss or NA)
    const firstGrandAttemptTime = firstGrandTime
      ? formatSecondsToMMSS(
          Math.round((firstGrandTime.getTime() - startTime.getTime()) / 1000)
        )
      : "NA";

    // 10. Rounds_Before_First_Grand_Attempt (or NA)
    const roundsBeforeFirstGrandAttempt =
      stat.roundsBeforeFirstGrandAttempt !== null
        ? stat.roundsBeforeFirstGrandAttempt
        : "NA";

    // 11. Letters_At_First_Grand_Attempt (or NA)
    const lettersAtFirstGrandAttempt =
      stat.lettersAtFirstGrandAttempt !== null
        ? stat.lettersAtFirstGrandAttempt
        : "NA";

    // 12. Final_Grand_Success_Time (mm:ss or NA)
    const finalGrandSuccessTime =
      stat.result === "Win" && endTime
        ? formatSecondsToMMSS(
            Math.round((endTime.getTime() - startTime.getTime()) / 1000)
          )
        : "NA";

    // 13. Total_Letters_Collected
    const totalLettersCollected = stat.totalLettersCollected;

    // 14. Result
    const result = stat.result || "Loss";

    // 15. Final_Grand_Word_Submitted (or NA)
    const finalGrandWordSubmitted = stat.finalGrandWordSubmitted || "NA";

    // 16. Possible_Grand_Word_Shown (or NA)
    const possibleGrandWordShown = stat.possibleGrandWordShown || "NA";

    return [
      date,
      gameId,
      username,
      mode,
      playersCount,
      gameDuration,
      totalRounds,
      miniCategoriesCompleted,
      firstGrandAttemptTime,
      roundsBeforeFirstGrandAttempt,
      lettersAtFirstGrandAttempt,
      finalGrandSuccessTime,
      totalLettersCollected,
      result,
      finalGrandWordSubmitted,
      possibleGrandWordShown,
    ];
  });

  // Authenticate with Google
  const accessToken = await getGoogleAuthToken();
  if (!accessToken) {
    console.warn(
      "[GameSessionStats] Could not obtain access token for logging."
    );
    return;
  }

  // Append to Sheet - A:P (16 columns)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(
    `'${SHEET_NAME}'!A:P`
  )}:append?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: rows }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(
      `[GameSessionStats] Failed to log data: ${res.status} ${res.statusText}`,
      errText
    );
    return;
  }

  console.log(
    `[GameSessionStats] Successfully logged ${rows.length} rows to sheet.`
  );

  // Mark as synced in DB
  const idsToUpdate = stats.map((s) => s.id);
  await db
    .updateTable("gameSessionStats")
    .set({ syncedToSheets: true })
    .where("id", "in", idsToUpdate)
    .execute();
}

/**
 * Fetches unsynced, finished sessions and logs them to Google Sheets.
 *
 * @param roomId Optional.
 * - If provided, fetches unsynced sessions for that specific room (Multiplayer).
 * - If not provided, fetches ALL unsynced sessions (both Multiplayer and Solo).
 */
export async function logGameSessionsToSheet(roomId?: number) {
  try {
    let query = db
      .selectFrom("gameSessionStats")
      // Left join allows us to get roomCode for multiplayer, but keeps solo rows where roomId is null
      .leftJoin("rooms", "rooms.id", "gameSessionStats.roomId")
      .select([
        "gameSessionStats.id",
        "rooms.code as roomCode",
        "gameSessionStats.soloSessionId",
        "gameSessionStats.playerId",
        "gameSessionStats.playerUsername",
        "gameSessionStats.gameMode",
        "gameSessionStats.gameStartTime",
        "gameSessionStats.gameEndTime",
        "gameSessionStats.firstGrandAttemptTime",
        "gameSessionStats.miniCategoriesSeen",
        "gameSessionStats.grandAttemptCount",
        "gameSessionStats.lettersAtFirstGrandAttempt",
        "gameSessionStats.totalLettersCollected",
        "gameSessionStats.playersCount",
        "gameSessionStats.totalRounds",
        "gameSessionStats.roundsBeforeFirstGrandAttempt",
        "gameSessionStats.result",
        "gameSessionStats.finalGrandWordSubmitted",
        "gameSessionStats.possibleGrandWordShown",
      ])
      .where("gameSessionStats.syncedToSheets", "=", false)
      .where("gameSessionStats.gameEndTime", "is not", null); // Only log finished sessions

    if (roomId !== undefined) {
      query = query.where("gameSessionStats.roomId", "=", roomId);
    }

    const stats = await query.execute();

    if (stats.length === 0) {
      if (roomId) {
        console.log(
          `[GameSessionStats] No unsynced finished sessions found for room ${roomId}.`
        );
      }
      return;
    }

    await processAndUploadStats(stats);
  } catch (error) {
    console.error("[GameSessionStats] Error logging to sheet:", error);
  }
}

/**
 * Specifically logs a single solo session to the sheet by its soloSessionId.
 */
export async function logSoloGameSessionToSheet(soloSessionId: string) {
  try {
    const stats = await db
      .selectFrom("gameSessionStats")
      .select([
        "gameSessionStats.id",
        "gameSessionStats.soloSessionId",
        "gameSessionStats.playerId",
        "gameSessionStats.playerUsername",
        "gameSessionStats.gameMode",
        "gameSessionStats.gameStartTime",
        "gameSessionStats.gameEndTime",
        "gameSessionStats.firstGrandAttemptTime",
        "gameSessionStats.miniCategoriesSeen",
        "gameSessionStats.grandAttemptCount",
        "gameSessionStats.lettersAtFirstGrandAttempt",
        "gameSessionStats.totalLettersCollected",
        "gameSessionStats.playersCount",
        "gameSessionStats.totalRounds",
        "gameSessionStats.roundsBeforeFirstGrandAttempt",
        "gameSessionStats.result",
        "gameSessionStats.finalGrandWordSubmitted",
        "gameSessionStats.possibleGrandWordShown",
      ])
      .where("soloSessionId", "=", soloSessionId)
      .where("syncedToSheets", "=", false)
      .where("gameEndTime", "is not", null)
      .execute();

    if (stats.length === 0) {
      console.log(
        `[GameSessionStats] No unsynced finished session found for solo session ${soloSessionId}.`
      );
      return;
    }

    // Add null roomCode for solo sessions
    const statsWithRoomCode = stats.map((s) => ({
      ...s,
      roomCode: null,
    }));

    await processAndUploadStats(statsWithRoomCode);
  } catch (error) {
    console.error(
      "[GameSessionStats] Error logging solo session to sheet:",
      error
    );
  }
}

// --- Auth Logic ---

interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
}

async function getGoogleAuthToken(): Promise<string | null> {
  const serviceAccountRaw = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT;
  if (!serviceAccountRaw) {
    console.error(
      "[GameSessionStats] Missing GOOGLE_SHEETS_SERVICE_ACCOUNT env var"
    );
    return null;
  }

  let creds: ServiceAccountCreds;
  try {
    creds = JSON.parse(serviceAccountRaw);
  } catch (e) {
    console.error(
      "[GameSessionStats] Failed to parse service account JSON",
      e
    );
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: creds.client_email,
    scope: SCOPES.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const toBase64Url = (obj: object) => {
    return Buffer.from(JSON.stringify(obj)).toString("base64url");
  };

  const encodedHeader = toBase64Url(header);
  const encodedClaim = toBase64Url(claim);
  const input = `${encodedHeader}.${encodedClaim}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(input);
  const signature = signer.sign(creds.private_key, "base64url");

  const jwt = `${input}.${signature}`;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Token exchange failed: ${errText}`);
    }

    const tokenData = await res.json();
    return tokenData.access_token;
  } catch (error) {
    console.error("[GameSessionStats] Error getting auth token:", error);
    return null;
  }
}