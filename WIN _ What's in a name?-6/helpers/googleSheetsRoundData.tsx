import crypto from "crypto";

const SHEET_ID = "1lUqqVvK73FgxV1_l01GjsiccxsDfFgFYzDmFxJmZlj8";
const PREFERRED_SHEET_NAME = "WORD DATA SHEET";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

// --- Types ---

export interface LogRoundDataParams {
  category: string;
  word: string;
  isValid: boolean;
  reason: string;
  playerName: string;
}

export interface OverrideResult {
  hasOverride: boolean;
  isValid?: boolean;
}

// --- Cache State ---

interface CacheEntry {
  isValid: boolean;
  isInvalid: boolean;
}

// In-memory cache for overrides
// Key: `${category}:${word}` (normalized to lowercase)
// Value: CacheEntry
let overrideCache: Map<string, CacheEntry> | null = null;
let lastCacheFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Track which sheet name actually works
let workingSheetName: string | null = null;

// --- Public Functions ---

/**
 * Fire-and-forget function to log round data to the Google Sheet.
 * Appends a row: [Category, Word, Is Valid, Is Invalid, Reason, User]
 */
export async function logRoundDataToSheet(params: LogRoundDataParams) {
  const { category, word, isValid, reason, playerName } = params;

  try {
    const accessToken = await getGoogleAuthToken();
    if (!accessToken) {
      console.warn("[RoundData] Could not obtain access token for logging.");
      return;
    }

    // Try to determine which sheet name to use
    const sheetName = await getWorkingSheetName(accessToken);
    
    const range = sheetName ? `'${sheetName}'!A:F` : "A:F";
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(
      range
    )}:append?valueInputOption=USER_ENTERED`;

    // Columns: A: Category, B: Word, C: Is Valid, D: Is Invalid, E: Reason, F: User
    const rowValues = [
      category,
      word,
      isValid ? true : false, // Column C
      !isValid ? true : false, // Column D
      reason,
      playerName,
    ];

    console.log(`[RoundData] Attempting to log data with range: ${range}`);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [rowValues] }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(
        `[RoundData] Failed to log data to range ${range}: ${res.status} ${res.statusText}`,
        errText
      );
      
      // If we failed with an explicit sheet name, try fallback to first sheet
      if (sheetName && res.status === 400) {
        console.log("[RoundData] Retrying with default (first) sheet...");
        const fallbackRange = "A:F";
        const fallbackUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(
          fallbackRange
        )}:append?valueInputOption=USER_ENTERED`;

        const fallbackRes = await fetch(fallbackUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ values: [rowValues] }),
        });

        if (fallbackRes.ok) {
          console.log("[RoundData] Successfully logged to default sheet");
          workingSheetName = null; // Remember to use default next time
        } else {
          const fallbackErrText = await fallbackRes.text();
          console.error(
            `[RoundData] Fallback also failed: ${fallbackRes.status} ${fallbackRes.statusText}`,
            fallbackErrText
          );
        }
      }
    } else {
      console.log(`[RoundData] Successfully logged data for word: ${word}`);
    }
  } catch (error) {
    console.error("[RoundData] Error logging to sheet:", error);
  }
}

/**
 * Checks if there is a manual override for the given word and category.
 * Uses an in-memory cache (TTL 5 mins) to reduce API calls.
 * Returns { hasOverride: false } if API fails or no override found.
 */
export async function checkManualOverride(
  rawWord: string,
  rawCategory: string
): Promise<OverrideResult> {
  const word = rawWord.trim().toLowerCase();
  const category = rawCategory.trim();

  try {
    await refreshCacheIfNeeded();

    if (!overrideCache) {
      return { hasOverride: false };
    }

    const key = generateCacheKey(category, word);
    const entry = overrideCache.get(key);

    if (!entry) {
      return { hasOverride: false };
    }

    if (entry.isValid) {
      return { hasOverride: true, isValid: true };
    }

    if (entry.isInvalid) {
      return { hasOverride: true, isValid: false };
    }

    return { hasOverride: false };
  } catch (error) {
    console.error("[RoundData] Error checking override:", error);
    return { hasOverride: false };
  }
}

// --- Internal Helpers ---

function generateCacheKey(category: string, word: string) {
  return `${category.toLowerCase()}:${word.toLowerCase()}`;
}

/**
 * Fetches spreadsheet metadata to verify sheet names exist and log them
 */
async function fetchSpreadsheetMetadata(
  accessToken: string
): Promise<string[]> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties.title`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(
        `[RoundData] Failed to fetch metadata: ${res.status} ${res.statusText}`,
        errText
      );
      return [];
    }

    const data = await res.json();
    const sheetNames =
      data.sheets?.map((s: any) => s.properties?.title).filter(Boolean) || [];

    console.log(
      `[RoundData] Available sheets in spreadsheet:`,
      sheetNames.join(", ")
    );

    return sheetNames;
  } catch (error) {
    console.error("[RoundData] Error fetching metadata:", error);
    return [];
  }
}

/**
 * Determines which sheet name to use for operations.
 * Caches the result to avoid repeated metadata fetches.
 */
async function getWorkingSheetName(
  accessToken: string
): Promise<string | null> {
  // If we already know which works, use it
  if (workingSheetName !== undefined) {
    return workingSheetName;
  }

  // Fetch metadata to see available sheets
  const availableSheets = await fetchSpreadsheetMetadata(accessToken);

  if (availableSheets.length === 0) {
    console.warn(
      "[RoundData] Could not fetch sheet names, will try preferred name and fallback"
    );
    workingSheetName = PREFERRED_SHEET_NAME;
    return workingSheetName;
  }

  // Check if preferred sheet exists
  if (availableSheets.includes(PREFERRED_SHEET_NAME)) {
    console.log(
      `[RoundData] Found preferred sheet: ${PREFERRED_SHEET_NAME}`
    );
    workingSheetName = PREFERRED_SHEET_NAME;
    return workingSheetName;
  }

  // Preferred sheet doesn't exist
  console.warn(
    `[RoundData] Preferred sheet "${PREFERRED_SHEET_NAME}" not found. Available: ${availableSheets.join(
      ", "
    )}`
  );
  console.warn(
    `[RoundData] Will use default (first) sheet. Consider creating "${PREFERRED_SHEET_NAME}" sheet.`
  );
  workingSheetName = null; // null means use default
  return workingSheetName;
}

async function refreshCacheIfNeeded() {
  const now = Date.now();
  if (overrideCache && now - lastCacheFetchTime < CACHE_TTL_MS) {
    return;
  }

  console.log("[RoundData] Refreshing override cache...");

  // Fetch data
  try {
    const accessToken = await getGoogleAuthToken();
    if (!accessToken) {
      throw new Error("No access token");
    }

    // Determine which sheet name to use
    const sheetName = await getWorkingSheetName(accessToken);

    // Build range - try with sheet name first
    const range = sheetName ? `'${sheetName}'!A:D` : "A:D";

    console.log(`[RoundData] Fetching overrides from range: ${range}`);

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(
      range
    )}`;

    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // If we got 400 and used explicit sheet name, try fallback to default
    if (!res.ok && res.status === 400 && sheetName) {
      const errText = await res.text();
      console.warn(
        `[RoundData] Failed to fetch with explicit sheet name: ${res.status}`,
        errText
      );
      console.log("[RoundData] Retrying with default (first) sheet...");

      const fallbackRange = "A:D";
      const fallbackUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(
        fallbackRange
      )}`;

      res = await fetch(fallbackUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        console.log("[RoundData] Successfully fetched from default sheet");
        workingSheetName = null; // Remember to use default
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Failed to fetch overrides: ${res.status} ${res.statusText} - ${errText}`
      );
    }

    const data = await res.json();
    const rows: any[][] = data.values || [];

    console.log(
      `[RoundData] Fetched ${rows.length} rows from sheet for override cache`
    );

    const newCache = new Map<string, CacheEntry>();

    // Skip header row if present (assuming row 1 is header)
    // We can just process all rows; if header doesn't match boolean logic it will be ignored
    let overrideCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // A: Category, B: Word, C: Is Valid, D: Is Invalid
      const cat = row[0]?.toString() || "";
      const w = row[1]?.toString() || "";
      const isValidRaw = row[2]?.toString()?.toUpperCase();
      const isInvalidRaw = row[3]?.toString()?.toUpperCase();

      if (!cat || !w) continue;

      const isValid = isValidRaw === "TRUE";
      const isInvalid = isInvalidRaw === "TRUE";

      if (isValid || isInvalid) {
        newCache.set(generateCacheKey(cat, w), { isValid, isInvalid });
        overrideCount++;
      }
    }

    console.log(
      `[RoundData] Cached ${overrideCount} overrides from ${rows.length} rows`
    );

    overrideCache = newCache;
    lastCacheFetchTime = now;
  } catch (error) {
    console.error("[RoundData] Failed to refresh override cache:", error);
    if (error instanceof Error) {
      console.error("[RoundData] Error details:", error.message);
    }
    // If refresh fails, we keep the old cache if it exists, or leave it null
    // We don't throw to avoid blocking the game
  }
}

// --- Auth Logic (Duplicated from googleSheetsWordStats to avoid circular deps or modifying existing files) ---

interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
}

async function getGoogleAuthToken(): Promise<string | null> {
  const serviceAccountRaw = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT;
  if (!serviceAccountRaw) {
    console.error("[RoundData] Missing GOOGLE_SHEETS_SERVICE_ACCOUNT env var");
    return null;
  }

  let creds: ServiceAccountCreds;
  try {
    creds = JSON.parse(serviceAccountRaw);
  } catch (e) {
    console.error("[RoundData] Failed to parse service account JSON", e);
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
    console.error("[RoundData] Error getting auth token:", error);
    return null;
  }
}