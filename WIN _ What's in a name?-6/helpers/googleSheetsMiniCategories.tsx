import { CategoryItem } from "./categoryPool";
import { db } from "./db";
import { sql } from "kysely";

// The ID of the source Google Sheet (same as Base Categories)
const GOOGLE_SHEET_ID = "1tEleNU1mI1CLiPqoiOA8OJZFyUtEgygySPCP580on0A";
const SHEET_TAB_NAME = "MINI_CATEGORIES_POOL";

/**
 * Parses a CSV string into a 2D array of strings.
 * Handles quoted strings with commas and escaped quotes.
 * Handles Windows/Unix line endings.
 * (Duplicated from googleSheetsCategories to keep this file self-contained)
 */
const parseCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = "";
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        // Handle escaped quote ("") inside a quoted string
        currentVal += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quote state
        insideQuote = !insideQuote;
      }
    } else if (char === "," && !insideQuote) {
      // End of cell
      currentRow.push(currentVal);
      currentVal = "";
    } else if ((char === "\r" || char === "\n") && !insideQuote) {
      // End of row
      // Handle \r\n sequence
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      // Only push if the row has content or we have accumulated values
      if (currentRow.length > 0 || currentVal.length > 0) {
        currentRow.push(currentVal);
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }

  // Push the last row if there's any remaining data
  if (currentRow.length > 0 || currentVal.length > 0) {
    currentRow.push(currentVal);
    rows.push(currentRow);
  }

  return rows;
};

/**
 * Fetches Mini Categories from the configured Google Sheet tab.
 * Expects:
 * - Column A (index 0): Category Name
 * - Column B (index 1): Status (Active/Inactive/Blank)
 */
export const fetchMiniCategoriesFromSheet = async (): Promise<
  CategoryItem[]
> => {
  // Using gviz/tq to select by sheet name
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
    SHEET_TAB_NAME
  )}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.statusText}`);
    }

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    const categories: CategoryItem[] = [];

    // Iterate through rows
    rows.forEach((row, index) => {
      // Skip header row if it exists (simple heuristic)
      if (index === 0 && row[0]?.toLowerCase() === "category") {
        return;
      }

      const categoryName = row[0]?.trim();
      const status = row[1]?.trim().toLowerCase();

      // 1. Check if category name exists
      if (!categoryName) return;

      // 2. Check status
      // - "inactive" -> skip
      // - "active" or blank -> keep
      if (status === "inactive") {
        return;
      }

      categories.push({
        id: `mini_gs_${index}`, // Auto-generated ID based on row index
        name: categoryName,
      });
    });

    return categories;
  } catch (error) {
    console.error("Error fetching mini categories from Google Sheet:", error);
    return [];
  }
};

// Simple in-memory cache for the duration of the module's lifecycle (or request in serverless)
let cachedCategories: CategoryItem[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

/**
 * Tries to fetch categories from Google Sheets.
 * If successful and returns data, uses it.
 * Otherwise, falls back to the provided local pool.
 * Implements simple caching.
 */
export const getMiniCategoriesWithFallback = async (
  fallbackCategories: CategoryItem[]
): Promise<CategoryItem[]> => {
  const now = Date.now();

  if (cachedCategories && now - lastFetchTime < CACHE_TTL) {
    return cachedCategories;
  }

  console.log("Attempting to fetch Mini Categories from Google Sheet...");
  const sheetCategories = await fetchMiniCategoriesFromSheet();

  if (sheetCategories && sheetCategories.length > 0) {
    console.log(
      `Successfully fetched ${sheetCategories.length} mini categories from Google Sheet.`
    );
    cachedCategories = sheetCategories;
    lastFetchTime = now;
    return sheetCategories;
  }

  console.warn(
    "Google Sheet fetch failed or returned empty. Using fallback categories."
  );
  return fallbackCategories;
};

/**
 * Clears the in-memory cache for mini categories.
 * Call this at the start of a new game to ensure fresh data is fetched from Google Sheets.
 */
export const clearMiniCategoriesCache = (): void => {
  cachedCategories = null;
  lastFetchTime = 0;
};

/**
 * Records that a player used a specific category + letter combination.
 * Uses upsert to update the timestamp if it already exists.
 */
export const trackCategoryLetterUsage = async (
  playerId: string,
  categoryName: string,
  letter: string
): Promise<void> => {
  if (!playerId || !categoryName || !letter) return;

  try {
    await db
      .insertInto("categoryLetterHistory")
      .values({
        playerId,
        categoryName,
        letter: letter.toUpperCase(),
        usedAt: new Date(), // Will be converted to timestamp by Kysely/Postgres
      })
      .onConflict((oc) =>
        oc.columns(["playerId", "categoryName", "letter"]).doUpdateSet({
          usedAt: new Date(),
        })
      )
      .execute();
  } catch (error) {
    console.error("Failed to track category letter usage:", error);
    // Non-blocking error, game can continue
  }
};

/**
 * Retrieves the most recent category+letter combinations used by this player.
 */
export const getRecentCategoryLetterCombinations = async (
  playerId: string,
  limit: number = 50
): Promise<{ categoryName: string; letter: string }[]> => {
  if (!playerId) return [];

  try {
    const history = await db
      .selectFrom("categoryLetterHistory")
      .select(["categoryName", "letter"])
      .where("playerId", "=", playerId)
      .orderBy("usedAt", "desc")
      .limit(limit)
      .execute();

    return history;
  } catch (error) {
    console.error("Failed to get recent category letter history:", error);
    return [];
  }
};

interface SelectionOptions {
  availableCategories: CategoryItem[];
  recentCategoryLetterHistory: { categoryName: string; letter: string }[];
  currentLetter: string;
  excludeCategoryNames?: string[]; // Categories used in this specific game session/room recently
}

/**
 * Selects a mini category with anti-repetition logic.
 *
 * Logic:
 * 1. Filter out categories explicitly excluded (e.g. used in the last 3 rounds of this room).
 * 2. Score remaining categories:
 *    - Base score: 0
 *    - Penalty: -100 if (category + currentLetter) is in recent history.
 * 3. Sort by score (descending) -> Randomize among top scorers.
 */
export const selectMiniCategoryWithAntiRepetition = async ({
  availableCategories,
  recentCategoryLetterHistory,
  currentLetter,
  excludeCategoryNames = [],
}: SelectionOptions): Promise<CategoryItem> => {
  const letter = currentLetter.toUpperCase();

  // 1. Filter out explicitly excluded categories (room-level anti-repetition)
  // We normalize to lowercase for comparison to be safe
  const excludedSet = new Set(excludeCategoryNames.map((n) => n.toLowerCase()));
  const candidates = availableCategories.filter(
    (c) => !excludedSet.has(c.name.toLowerCase())
  );

  // If we filtered everything out (unlikely), fall back to the full available list
  const pool = candidates.length > 0 ? candidates : availableCategories;

  // 2. Score categories based on player history
  // Create a set of "used combinations" for O(1) lookup
  // Format: "CATEGORY_NAME|LETTER"
  const usedCombinations = new Set(
    recentCategoryLetterHistory.map(
      (h) => `${h.categoryName.toLowerCase()}|${h.letter.toUpperCase()}`
    )
  );

  const scoredCategories = pool.map((category) => {
    const key = `${category.name.toLowerCase()}|${letter}`;
    let score = 0;

    if (usedCombinations.has(key)) {
      score -= 100; // Heavy penalty for reusing a category with the SAME letter
    }

    // We could add a smaller penalty for reusing the category with ANY letter if we wanted,
    // but the prompt specifically asks about category+letter combinations.

    return { category, score };
  });

  // 3. Find the best score
  // Since we only have 0 or -100, "best" is usually 0.
  const maxScore = Math.max(...scoredCategories.map((s) => s.score));

  // 4. Filter for only the best options
  const bestOptions = scoredCategories.filter((s) => s.score === maxScore);

  // 5. Pick a random one from the best options
  const selected =
    bestOptions[Math.floor(Math.random() * bestOptions.length)].category;

  return selected;
};