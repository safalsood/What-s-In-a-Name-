import {
  CATEGORY_POOL,
  BASE_CATEGORY_POOL,
  CategoryItem
} from "./categoryPool";
import { getBaseCategoriesWithFallback } from "./googleSheetsCategories";
import {
  getMiniCategoriesWithFallback,
  getRecentCategoryLetterCombinations
} from "./googleSheetsMiniCategories";
import { TOUGH_LETTERS } from "./gameLogic";
import { getCategoryDifficultyScore } from "./gameAnalytics";

// --- Constants for Cross-Game Repetition ---
// Categories won't repeat for the same player for at least 5 COMPLETED GAMES (not rounds).
// After 5 games, a category becomes eligible for reuse.
export const GAMES_BEFORE_CATEGORY_REPEAT = 5;

// --- Types ---

export interface SelectMiniCategoryOptions {
  currentLetters: string[];
  usedMiniCategories: string[]; // IDs of categories already used in this match
  failedMiniCategories: string[]; // IDs of categories that resulted in a timeout/failure
  consecutiveFailures: number;
  baseCategory: string; // ID of the base category to exclude
  playerCategoryHistories?: string[]; // Category names used by player(s) in last 4-5 games (cross-game tracking)
  playerId?: string; // Optional player ID for fetching specific category+letter history
}

// --- Constants & Metadata ---

// Heuristic: Map ID ranges to breadth scores based on the structure in categoryPool.tsx
// c1-c110: Easy/General (High Breadth)
// c111-c160: Medium (Medium Breadth)
// c161-c180: Mixed (Medium-High Breadth)
// c181-c205: Hard (Low Breadth)
const getBreadthFromId = (id: string): number => {
  // Extract number from "c123"
  const num = parseInt(id.replace("c", ""), 10);
  if (isNaN(num)) return 5; // Default fallback

  if (num <= 110) return 9; // Very broad
  if (num <= 160) return 6; // Medium
  if (num <= 180) return 7; // Mixed/Broad
  return 3; // Hard/Narrow
};

// Categories known to have answers for tough letters (Q, X, Z, J, K, V)
// This is a heuristic list based on common knowledge of these categories.
const TOUGH_LETTER_FRIENDLY_KEYWORDS = [
  "Animals", "Countries", "Cities", "Foods", "Science", "Chemical",
  "Words ending", "Words starting", "letter words", "Scrabble", "Dictionary"
];

const TOUGH_LETTER_FRIENDLY_IDS = new Set([
  // Animals with tough letters (Q=Quail, X=Xerus, K=Koala, V=Vole, J=Jaguar/Jackal, Z=Zebra)
  "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c16", "c17", "c18", "c19", "c20",
  // Geography - Countries, Cities, Places (Q=Qatar, Z=Zambia, J=Japan/Jordan, K=Kenya, V=Vietnam)
  "c81", "c82", "c83", "c84", "c85", "c86", "c87", "c97", "c99", "c100",
  // Science - Has X/Z elements and technical terms
  "c136", "c190", "c191", "c192",
  // Foods with tough letters (Q=Quinoa, K=Kebab, V=Vinegar, J=Juice/Jambolan)
  "c21", "c22", "c23", "c24", "c25", "c26", "c27", "c28", "c29", "c30", "c35", "c36",
  // Sports (J=Judo, K=Karate, V=Volleyball, Z=Zumba implied)
  "c111", "c112", "c113", "c114", "c115",
  // Music (J=Jazz, V=Violin, K=Keyboard)
  "c118", "c119", "c151", "c152",
  // Professions (J=Judge/Janitor, K=Keeper, V=Vendor)
  "c61", "c62", "c63", "c64",
  // Word structure categories (very flexible)
  "c181", "c182", "c183", "c184", "c185", "c186", "c187", "c188",
  // Objects (K=Key, V=Vase, J=Jar)
  "c160", "c161", "c162", "c163", "c164", "c165", "c166", "c169",
  // Clothing (J=Jacket, V=Vest, K=Kimono)
  "c101", "c102", "c103", "c104", "c105", "c106", "c107", "c108",
  // Nature (J=Jungle, V=Valley, V=Volcano)
  "c9", "c10", "c11", "c12", "c13", "c195", "c196", "c197", "c198", "c199",
  // Actions (J=Jump, K=Kick)
  "c141", "c142", "c143", "c144", "c145", "c146", "c147", "c148",
  // Animals species (many exotic names with tough letters)
  "c201", "c202", "c203", "c204", "c205"
]);

// --- Public Interface ---

/**
 * Selects a random easy/broad base category.
 * Base categories are locked for the match and must be broad.
 * Fetches categories from Google Sheets with local fallback.
 */
export const selectBaseCategory = async (): Promise<CategoryItem> => {
  const pool = await getBaseCategoriesWithFallback(BASE_CATEGORY_POOL);
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
};

/**
 * Returns a breadth score from 1-10 for a given category.
 * Higher score = Broader, easier, more possible answers.
 */
export const getCategoryBreadthScore = (category: CategoryItem): number => {
  return getBreadthFromId(category.id);
};

/**
 * Checks if a category is generally good for tough letters (Q, X, Z, J).
 */
export const isGoodForToughLetters = (category: CategoryItem): boolean => {
  if (TOUGH_LETTER_FRIENDLY_IDS.has(category.id)) return true;
  return TOUGH_LETTER_FRIENDLY_KEYWORDS.some(keyword =>
    category.name.toLowerCase().includes(keyword.toLowerCase())
  );
};

/**
 * Estimates compatibility (0-1) of a category with the given set of letters.
 *
 * Logic:
 * - If no tough letters are present, compatibility is generally high (1.0).
 * - If tough letters are present, we check if the category is "tough friendly".
 * - If tough letters exist but category is NOT tough friendly, score drops significantly.
 */
export const estimateLetterCompatibility = (category: CategoryItem, letters: string[]): number => {
  const hasToughLetter = letters.some(l => TOUGH_LETTERS.includes(l.toUpperCase()));

  if (!hasToughLetter) {
    // Common letters usually work with almost anything, but we penalize very narrow categories slightly
    const breadth = getBreadthFromId(category.id);
    return breadth >= 5 ? 1.0 : 0.8;
  }

  // We have tough letters
  if (isGoodForToughLetters(category)) {
    return 0.9; // Good chance
  }

  // Tough letters + Narrow/Unfriendly category = Bad combo
  return 0.3;
};

/**
 * Selects the optimal mini category for the next round.
 * Now async to fetch dynamic difficulty scores from analytics.
 */
export const selectMiniCategory = async (options: SelectMiniCategoryOptions): Promise<CategoryItem> => {
  const {
    currentLetters,
    usedMiniCategories,
    failedMiniCategories,
    consecutiveFailures,
    baseCategory,
  playerCategoryHistories = [],
    playerId
  } = options;

  // 0. Fetch Mini Categories from Google Sheets (with fallback)
  const availableMiniCategories = await getMiniCategoriesWithFallback(CATEGORY_POOL);

  // 1. Start with all unused Mini Categories
  // We also exclude the base category ID if it happens to match a mini category ID (unlikely but safe)
  // and exclude the base category name to be sure.
  // ALSO exclude categories from player history (cross-game repetition tracking)
  // The player history now includes BOTH base and mini categories from their last 5 games
  let candidates = availableMiniCategories.filter(c =>
    !usedMiniCategories.includes(c.id) &&
    c.id !== baseCategory &&
    c.name !== baseCategory && // Simple name check just in case
    !playerCategoryHistories.includes(c.name) // Cross-game exclusion for ALL category types
  );

  // 2. Filter Logic

  // If we have recently failed categories, try to avoid them for a while.
  // However, if we are running low on categories, we might need to reuse (unlikely in a normal game).
  // For now, strict exclusion of failed categories from this match session.
  const failedFiltered = candidates.filter(c => !failedMiniCategories.includes(c.id));
  
  // Only apply failed filter if we have enough candidates left
  if (failedFiltered.length >= 10) {
    candidates = failedFiltered;
  }

  // FAIL-SAFE: If 2+ consecutive failures, we MUST pick from broader categories.
  if (consecutiveFailures >= 2) {
    const broadCandidates = candidates.filter(c => getBreadthFromId(c.id) >= 6);
    // Only apply breadth filter if we have enough candidates left
    if (broadCandidates.length >= 5) {
      candidates = broadCandidates;
    }
  }

  // If we filtered everything out (edge case), reset to full unused pool
  if (candidates.length === 0) {
    candidates = availableMiniCategories.filter(c => !usedMiniCategories.includes(c.id));
  }

  // Final fallback - if still empty, use entire pool (should never happen)
  if (candidates.length === 0) {
    console.warn("All categories exhausted, resetting to full pool");
    candidates = availableMiniCategories;
  }

  // Fetch recent category+letter history if playerId is provided
  const recentHistory = playerId 
    ? await getRecentCategoryLetterCombinations(playerId, 100) 
    : [];
  
  // Create a Set of "CATEGORY|LETTER" for fast lookup
  const recentHistorySet = new Set(
    recentHistory.map(h => `${h.categoryName.toLowerCase()}|${h.letter.toUpperCase()}`)
  );

  // 3. Scoring Logic - Now async to fetch dynamic difficulty
  const scoredCandidates = await Promise.all(candidates.map(async (category) => {
    const breadthScore = getCategoryBreadthScore(category); // 1-10
    const compatibilityScore = estimateLetterCompatibility(category, currentLetters); // 0-1
    
    // NEW: Get dynamic difficulty from analytics (1=easy/high success, 10=hard/low success)
    const difficultyScore = await getCategoryDifficultyScore(category.name); // 1-10
    
    // Convert difficulty to "ease factor" - we want easier categories to score higher
    // difficultyScore 1 (very easy) -> easeFactor 10
    // difficultyScore 10 (very hard) -> easeFactor 1
    const easeFactor = 11 - difficultyScore;

    // Weighted Score Calculation
    // We now balance: breadth (static), compatibility (letters), and ease (dynamic from analytics)
    // Prioritize: dynamic difficulty (40%), compatibility (35%), breadth (25%)
    let finalScore = (breadthScore * 0.25) + (compatibilityScore * 10 * 0.35) + (easeFactor * 0.40);

    // DIFFICULTY ADJUSTMENTS:
    // Penalize very hard categories (difficulty > 7)
    if (difficultyScore > 7) {
      finalScore -= 2;
    }
    // Slightly boost moderate difficulty categories (4-6) - balanced challenge
    if (difficultyScore >= 4 && difficultyScore <= 6) {
      finalScore += 1;
    }

    // PLAYABILITY SAFEGUARD:
    // If tough letters are present, boost "tough friendly" categories even more
    const hasToughLetter = currentLetters.some(l => TOUGH_LETTERS.includes(l.toUpperCase()));
    if (hasToughLetter && isGoodForToughLetters(category)) {
      finalScore += 3; // Bonus
    }

    // FRESHNESS BONUS:
    // Categories not in player history get a freshness bonus
    // This encourages variety across games for individual players
    const isNotInHistory = !playerCategoryHistories.includes(category.name);
    if (isNotInHistory) {
      finalScore += 2; // Freshness bonus
    }

    // ANTI-REPETITION PENALTY (Category + Letter)
    // Check if this category has been used with ANY of the current letters recently
    let repetitionPenalty = 0;
    for (const letter of currentLetters) {
      const key = `${category.name.toLowerCase()}|${letter.toUpperCase()}`;
      if (recentHistorySet.has(key)) {
        repetitionPenalty += 50; // Heavy penalty per repeated combination
      }
    }
    finalScore -= repetitionPenalty;

    return { category, score: finalScore };
  }));

  // 4. Selection
  // Sort by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  // To avoid predictability, we don't just pick the #1.
  // We pick randomly from the top 20% or top 10 candidates, whichever is smaller.
  const topCount = Math.max(5, Math.floor(scoredCandidates.length * 0.2));
  const topTier = scoredCandidates.slice(0, topCount);

  if (topTier.length === 0) {
    // Fallback (should never happen unless pool is empty)
    return availableMiniCategories[0];
  }

  const selected = topTier[Math.floor(Math.random() * topTier.length)];
  return selected.category;
};

/**
 * Selects a base category for the match, avoiding categories recently seen by any player.
 * Fetches categories from Google Sheets with local fallback.
 *
 * @param playerCategoryHistories - Combined list of category names from all players' recent games (last 4-5 games)
 * @returns A randomly selected base category that players haven't seen recently
 */
export const selectBaseCategoryForPlayers = async (
  playerCategoryHistories: string[] = []
): Promise<CategoryItem> => {
  // Fetch base categories from Google Sheets with fallback to local pool
  const pool = await getBaseCategoriesWithFallback(BASE_CATEGORY_POOL);

  // Filter out categories that any player has seen in their recent history
  let availableCategories = pool.filter(
    c => !playerCategoryHistories.includes(c.name)
  );

  // FALLBACK: If all base categories have been used recently (very rare in normal play),
  // fall back to the full pool. This ensures the game never stalls.
  if (availableCategories.length === 0) {
    console.warn(
      "All base categories have been recently used by players. Falling back to full base category pool."
    );
    availableCategories = pool;
  }

  // Select randomly from available categories
  const randomIndex = Math.floor(Math.random() * availableCategories.length);
  return availableCategories[randomIndex];
};