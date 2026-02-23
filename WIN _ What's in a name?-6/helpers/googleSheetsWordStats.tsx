import { db } from "./db";
import { sql } from "kysely";
import crypto from "crypto";

const SHEET_ID = "1Cox_Ms9EqDhk_rk_QXZpKSzkOL7G22akUuu0Ui2R3kE";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

/**
 * Updates the word_category_stats table in the database.
 * - Increments total_accepted_count
 * - Adds playerId to unique_user_ids if not present
 * - Uses upsert pattern
 * - Returns the updated stats row
 */
export async function updateWordCategoryStats(
  playerId: string,
  rawWord: string,
  category: string
) {
  const word = rawWord.toLowerCase();

  try {
    // 1. Try to update existing row
    // We use a complex SQL snippet to ensure the playerId is added to the array uniquely
    const updateResult = await db
      .updateTable("wordCategoryStats")
      .set((eb) => ({
        totalAcceptedCount: eb("totalAcceptedCount", "+", 1),
        // Postgres array logic: append then distinct
        uniqueUserIds: sql<
          string[]
        >`(SELECT array_agg(DISTINCT x) FROM unnest(array_append("unique_user_ids", ${playerId})) t(x))`,
        updatedAt: new Date(),
      }))
      .where("category", "=", category)
      .where("word", "=", word)
      .returningAll()
      .executeTakeFirst();

    if (updateResult) {
      return updateResult;
    }

    // 2. If update failed (no row), insert new row
    const insertResult = await db
      .insertInto("wordCategoryStats")
      .values({
        category,
        word,
        totalAcceptedCount: 1,
        uniqueUserIds: [playerId],
        updatedAt: new Date(),
        // lastSyncedAt is null by default
      })
      .returningAll()
      .executeTakeFirst();

    return insertResult;
  } catch (error) {
    // Handle potential race condition where insert fails because another request created it
    console.warn(
      `[WordStats] Race condition or error updating stats for ${word} in ${category}:`,
      error
    );

    // Retry update once
    try {
      return await db
        .updateTable("wordCategoryStats")
        .set((eb) => ({
          totalAcceptedCount: eb("totalAcceptedCount", "+", 1),
          uniqueUserIds: sql<
            string[]
          >`(SELECT array_agg(DISTINCT x) FROM unnest(array_append("unique_user_ids", ${playerId})) t(x))`,
          updatedAt: new Date(),
        }))
        .where("category", "=", category)
        .where("word", "=", word)
        .returningAll()
        .executeTakeFirst();
    } catch (retryError) {
      console.error(
        `[WordStats] Failed to recover from error for ${word}:`,
        retryError
      );
      return null;
    }
  }
}

/**
 * Main orchestration function.
 * Updates DB stats, then checks if sync is needed.
 * If needed, triggers sync asynchronously (fire-and-forget).
 */
export async function checkAndSyncToSheet(
  playerId: string,
  word: string,
  category: string
) {
  // 1. Update DB (Await this to ensure data integrity before deciding to sync)
  const stats = await updateWordCategoryStats(playerId, word, category);

  if (!stats) return;

  // 2. Check criteria: total_accepted_count >= 3
  if (stats.totalAcceptedCount >= 3) {
    // 3. Fire and forget sync
    // We do NOT await this promise so we don't block the game loop
    syncWordToGoogleSheet(
      stats.category,
      stats.word,
      stats.totalAcceptedCount,
      stats.uniqueUserIds.length
    )
      .then(async () => {
        // 4. On success, update last_synced_at
        try {
          await db
            .updateTable("wordCategoryStats")
            .set({ lastSyncedAt: new Date() })
            .where("id", "=", stats.id)
            .execute();
        } catch (err) {
          console.error("[WordStats] Failed to update lastSyncedAt:", err);
        }
      })
      .catch((err) => {
        console.error(
          `[WordStats] Background sync failed for ${word}:`,
          err instanceof Error ? err.message : err
        );
      });
  }
}

// --- Google Sheets Logic ---

/**
 * Syncs a single word's stats to the Google Sheet.
 * Checks if row exists to decide between Update or Append.
 */
export async function syncWordToGoogleSheet(
  category: string,
  word: string,
  totalCount: number,
  uniqueUserCount: number
) {
  try {
    const accessToken = await getGoogleAuthToken();
    if (!accessToken) {
      throw new Error("Could not obtain Google Access Token");
    }

    // 1. Fetch all existing data to find the row
    // Range A:B covers Category and Word columns
    const fetchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A:B`;
    const fetchRes = await fetch(fetchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!fetchRes.ok) {
      throw new Error(
        `Failed to fetch sheet data: ${fetchRes.status} ${fetchRes.statusText}`
      );
    }

    const data = await fetchRes.json();
    const rows: string[][] = data.values || [];

    // Find row index (1-based for API, but array is 0-based)
    // Row 1 is likely header, so we search all.
    // Match: Column A (index 0) == category AND Column B (index 1) == word
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const rowCat = rows[i][0];
      const rowWord = rows[i][1];
      if (rowCat === category && rowWord === word) {
        rowIndex = i + 1; // Sheets API uses 1-based indexing
        break;
      }
    }

    const values = [category, word, totalCount, uniqueUserCount];

    if (rowIndex !== -1) {
      // UPDATE existing row
      // We update columns A:D for that row
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A${rowIndex}:D${rowIndex}?valueInputOption=USER_ENTERED`;
      const updateRes = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [values] }),
      });

      if (!updateRes.ok) {
        throw new Error(
          `Failed to update row ${rowIndex}: ${updateRes.statusText}`
        );
      }
    } else {
      // APPEND new row
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A:D:append?valueInputOption=USER_ENTERED`;
      const appendRes = await fetch(appendUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [values] }),
      });

      if (!appendRes.ok) {
        throw new Error(`Failed to append row: ${appendRes.statusText}`);
      }
    }
  } catch (error) {
    // Re-throw to be caught by the caller (checkAndSyncToSheet)
    throw error;
  }
}

// --- Auth Helpers ---

interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
}

/**
 * Generates a Google OAuth2 Access Token using a Service Account.
 * Implements JWT signing manually using Node's crypto module to avoid extra dependencies.
 */
async function getGoogleAuthToken(): Promise<string | null> {
  const serviceAccountRaw = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT;
  if (!serviceAccountRaw) {
    console.error("[WordStats] Missing GOOGLE_SHEETS_SERVICE_ACCOUNT env var");
    return null;
  }

  let creds: ServiceAccountCreds;
  try {
    creds = JSON.parse(serviceAccountRaw);
  } catch (e) {
    console.error("[WordStats] Failed to parse service account JSON", e);
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: creds.client_email,
    scope: SCOPES.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600, // 1 hour expiration
    iat: now,
  };

  // Base64Url Encode
  const toBase64Url = (obj: object) => {
    return Buffer.from(JSON.stringify(obj)).toString("base64url");
  };

  const encodedHeader = toBase64Url(header);
  const encodedClaim = toBase64Url(claim);
  const input = `${encodedHeader}.${encodedClaim}`;

  // Sign
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(input);
  const signature = signer.sign(creds.private_key, "base64url");

  const jwt = `${input}.${signature}`;

  // Exchange JWT for Access Token
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
    console.error("[WordStats] Error getting auth token:", error);
    return null;
  }
}