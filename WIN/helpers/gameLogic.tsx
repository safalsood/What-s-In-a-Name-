import { Category } from "../endpoints/categories_GET.schema";

export const TOUGH_LETTERS = ["Q", "X", "Z", "J", "K", "V"];
export const VOWELS = ["A", "E", "I", "O", "U"];
export const COMMON_LETTERS = "ABCDEFGHILMNOPRSTUWY".split("");

export type Difficulty = "easy" | "medium" | "hard";

export interface GameSettings {
  difficulty: Difficulty;
}

export const DEFAULT_SETTINGS: GameSettings = {
  difficulty: "medium",
};

export const CATEGORIES = [
  { id: "animals", name: "Animals", description: "Living creatures from around the world" },
  { id: "colors", name: "Colors", description: "Shades, hues, and pigments" },
  { id: "adjectives", name: "Adjectives", description: "Words that describe nouns" },
  { id: "foods", name: "Foods", description: "Edible items and dishes" },
  { id: "countries", name: "Countries", description: "Nations and sovereign states" },
  { id: "sports", name: "Sports", description: "Physical activities and games" },
  { id: "professions", name: "Professions", description: "Jobs, careers, and occupations" },
  { id: "emotions", name: "Emotions", description: "Feelings and moods" },
  { id: "nature", name: "Nature", description: "Plants, landscapes, and natural phenomena" },
  { id: "objects", name: "Objects", description: "Inanimate physical items" },
  { id: "actions", name: "Actions", description: "Verbs and physical movements" },
  { id: "music", name: "Music", description: "Instruments, genres, and musical terms" },
  { id: "science", name: "Science", description: "Scientific terms, elements, and concepts" },
  { id: "weather", name: "Weather", description: "Meteorological conditions" },
  { id: "clothing", name: "Clothing", description: "Apparel and accessories" },
];

export const getSettings = (): GameSettings => {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const stored = localStorage.getItem("word-challenge-settings");
  return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
};

export const saveSettings = (settings: GameSettings) => {
  localStorage.setItem("word-challenge-settings", JSON.stringify(settings));
};

/**
 * Validates that no letter appears more than twice in the letter set.
 */
export const validateLetterSet = (letters: string[]): boolean => {
  const counts = new Map<string, number>();
  for (const letter of letters) {
    counts.set(letter, (counts.get(letter) || 0) + 1);
    if (counts.get(letter)! > 2) {
      return false;
    }
  }
  return true;
};

/**
 * Generates a set of 5 letters with strict rules:
 * - Exactly 1 tough letter (Q, X, Z, J, K, V)
 * - At least 1 vowel (A, E, I, O, U)
 * - 3 remaining common letters
 * - No letter appears more than twice
 */
export const generateRoundLetters = (): string[] => {
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // Pick exactly one tough letter
    const toughLetter = TOUGH_LETTERS[Math.floor(Math.random() * TOUGH_LETTERS.length)];
    const letters: string[] = [toughLetter];
    
    // Always pick at least one vowel first
    const vowel = VOWELS[Math.floor(Math.random() * VOWELS.length)];
    letters.push(vowel);
    
    // Generate 3 more common letters
    for (let i = 0; i < 3; i++) {
      const letter = COMMON_LETTERS[Math.floor(Math.random() * COMMON_LETTERS.length)];
      letters.push(letter);
    }
    
    // Validate the set
    if (validateLetterSet(letters)) {
      // Shuffle and return
      return letters.sort(() => Math.random() - 0.5);
    }
  }
  
  // Fallback: If we somehow can't generate a valid set after 100 attempts,
  // manually create a valid set with guaranteed no duplicates and at least 1 vowel
  console.warn("Failed to generate valid letter set after max attempts, using fallback");
  const toughLetter = TOUGH_LETTERS[Math.floor(Math.random() * TOUGH_LETTERS.length)];
  const vowel = VOWELS[Math.floor(Math.random() * VOWELS.length)];
  const uniqueCommon: string[] = [vowel];
  const commonPool = [...COMMON_LETTERS].filter(l => l !== vowel);
  
  for (let i = 0; i < 3 && commonPool.length > 0; i++) {
    const index = Math.floor(Math.random() * commonPool.length);
    uniqueCommon.push(commonPool[index]);
    commonPool.splice(index, 1);
  }
  
  return [toughLetter, ...uniqueCommon].sort(() => Math.random() - 0.5);
};

/**
 * Replaces a used letter with a new one, ensuring no letter appears more than twice
 * and at least one vowel remains.
 */
export const replaceUsedLetter = (letters: string[], usedLetter: string): string[] => {
  // Remove the used letter
  const remaining = letters.filter(l => l !== usedLetter);
  
  // Check if we still have a tough letter
  const hasToughLetter = remaining.some(l => TOUGH_LETTERS.includes(l));
  
  // Check if we still have a vowel
  const hasVowel = remaining.some(l => VOWELS.includes(l));
  
  // Count current letter occurrences
  const letterCounts = new Map<string, number>();
  for (const letter of remaining) {
    letterCounts.set(letter, (letterCounts.get(letter) || 0) + 1);
  }
  
  let attempts = 0;
  const maxAttempts = 50;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // Generate new letter with priority order:
    // 1. If no vowel, MUST add vowel
    // 2. If no tough letter, bias towards tough
    // 3. Otherwise, random common letter
    let newLetter: string;
    if (!hasVowel) {
      // MUST have a vowel - pick one
      newLetter = VOWELS[Math.floor(Math.random() * VOWELS.length)];
    } else if (!hasToughLetter && Math.random() > 0.3) {
      // 70% chance to add a tough letter if none exist
      newLetter = TOUGH_LETTERS[Math.floor(Math.random() * TOUGH_LETTERS.length)];
    } else if (Math.random() > 0.8 && hasToughLetter) {
      // 20% chance for tough letter even if we have one
      newLetter = TOUGH_LETTERS[Math.floor(Math.random() * TOUGH_LETTERS.length)];
    } else {
      // Common letter
      newLetter = COMMON_LETTERS[Math.floor(Math.random() * COMMON_LETTERS.length)];
    }
    
    // Check if adding this letter would create 3+ of the same letter
    const newLetterCount = letterCounts.get(newLetter) || 0;
    if (newLetterCount < 2) {
      // Valid replacement - no more than 2 of this letter
      const newLetters = [...remaining, newLetter];
      return newLetters.sort(() => Math.random() - 0.5);
    }
  }
  
  // Fallback: Find any letter that doesn't appear twice already
  // Priority: vowel if needed, then tough if needed, then common
  let availablePool: string[];
  if (!hasVowel) {
    availablePool = VOWELS;
  } else if (hasToughLetter) {
    availablePool = COMMON_LETTERS;
  } else {
    availablePool = [...COMMON_LETTERS, ...TOUGH_LETTERS];
  }
  
  for (const letter of availablePool) {
    if ((letterCounts.get(letter) || 0) < 2) {
      const newLetters = [...remaining, letter];
      return newLetters.sort(() => Math.random() - 0.5);
    }
  }
  
  // Last resort fallback (should never happen)
  console.warn("Could not find valid replacement letter, using fallback");
  const fallbackLetter = !hasVowel ? "A" : (hasToughLetter ? "A" : "Q");
  return [...remaining, fallbackLetter].sort(() => Math.random() - 0.5);
};

export const getAiDelay = (difficulty: Difficulty): number => {
  // Returns delay in ms
  switch (difficulty) {
    case "easy": return Math.random() * 8000 + 12000; // 12-20s
    case "medium": return Math.random() * 6000 + 6000; // 6-12s
    case "hard": return Math.random() * 4000 + 3000; // 3-7s
  }
};

// Expanded word bank for AI with more variety and better category coverage
const AI_FALLBACK_WORDS: Record<string, string[]> = {
  "Animals": ["ZEBRA", "CAT", "DOG", "QUAIL", "FOX", "JAGUAR", "KOALA", "VOLE", "LION", "TIGER", "BEAR", "WOLF", "RABBIT", "XERUS", "YAK", "JACKAL", "KANGAROO", "VULTURE"],
  "Colors": ["RED", "BLUE", "GREEN", "YELLOW", "VIOLET", "INDIGO", "KHAKI", "AZURE", "JADE", "QUARTZ", "VERMILLION", "CRIMSON", "AMBER", "BRONZE", "ZINC"],
  "Fruits": ["APPLE", "BANANA", "KIWI", "QUINCE", "JAMBOLAN", "GRAPE", "LEMON", "MANGO", "ORANGE", "PEACH", "PLUM", "CHERRY", "BERRY"],
  "Foods": ["PIZZA", "BREAD", "RICE", "PASTA", "QUINOA", "KEBAB", "YOGURT", "JUICE", "CAKE", "TACO", "WAFFLE", "HONEY", "VINEGAR"],
  "Countries": ["QATAR", "ZAMBIA", "JAPAN", "KENYA", "VIETNAM", "CANADA", "MEXICO", "FRANCE", "ITALY", "SPAIN", "BRAZIL", "EGYPT", "JORDAN"],
  "Sports": ["JUDO", "KARATE", "VOLLEYBALL", "BOXING", "RACING", "TENNIS", "HOCKEY", "RUGBY", "YOGA", "WRESTLING", "FENCING", "ARCHERY"],
  "Professions": ["JUDGE", "TEACHER", "DOCTOR", "BAKER", "WRITER", "VENDOR", "KEEPER", "JANITOR", "CAPTAIN", "ARTIST", "MUSICIAN", "CHEMIST"],
  "Emotions": ["JOY", "HAPPY", "SAD", "ANGRY", "CALM", "EAGER", "AFRAID", "WORRIED", "EXCITED", "PEACEFUL", "JEALOUS", "BITTER", "CONTENT"],
  "Nature": ["TREE", "RIVER", "OCEAN", "VALLEY", "JUNGLE", "MOUNTAIN", "FOREST", "BEACH", "MEADOW", "CANYON", "VOLCANO", "DESERT", "PLAIN"],
  "Objects": ["KEY", "VASE", "JAR", "BOX", "CUP", "KNIFE", "CHAIR", "TABLE", "BOOK", "PEN", "CLOCK", "MIRROR", "BASKET"],
  "Actions": ["JUMP", "RUN", "WALK", "KICK", "THROW", "CATCH", "WRITE", "READ", "SPEAK", "LISTEN", "DANCE", "SING", "BUILD"],
  "Music": ["JAZZ", "VIOLIN", "PIANO", "OPERA", "BEAT", "RHYTHM", "VOCAL", "CHORUS", "MELODY", "HARMONY", "TEMPO", "BASS"],
  "Science": ["ATOM", "CELL", "VIRUS", "QUANTUM", "ENERGY", "KINETIC", "OXIDE", "ENZYME", "NEUTRON", "PROTON", "BOSON", "CHEMISTRY"],
  "Weather": ["RAIN", "WIND", "SNOW", "FROST", "HAIL", "STORM", "BREEZE", "CYCLONE", "TORNADO", "HURRICANE", "THUNDER", "LIGHTNING"],
  "Clothing": ["JACKET", "VEST", "PANTS", "COAT", "ROBE", "SKIRT", "DRESS", "JEANS", "TUNIC", "UNIFORM", "KIMONO", "SCARF"],
  "Adjectives": ["QUICK", "VAST", "JOLLY", "KEEN", "WARM", "COLD", "BRIGHT", "DARK", "SOFT", "HARD", "LIGHT", "HEAVY", "SMOOTH"],
  "default": ["QUICK", "JUMP", "KITE", "VINE", "ZEBRA", "WORD", "GAME", "PLAY", "TEST", "VALUE", "WORTHY", "BRIGHT", "VITAL", "KNOWN", "JOVIAL"]
};

export const getAiWord = (
  categoryName: string, 
  availableLetters: string[], 
  difficulty: Difficulty
): string | null => {
  const bank = AI_FALLBACK_WORDS[categoryName] || AI_FALLBACK_WORDS["default"];
  
  // Filter words that start with available letters
  let candidates = bank.filter(word => 
    availableLetters.includes(word.charAt(0).toUpperCase())
  );
  
  if (candidates.length === 0) {
    const randomLetter = availableLetters[Math.floor(Math.random() * availableLetters.length)];
    return `${randomLetter}ZZY`; 
  }

  // Difficulty logic
  if (difficulty === "hard") {
    // Try to find tough letter words
    const toughCandidates = candidates.filter(w => TOUGH_LETTERS.includes(w.charAt(0)));
    if (toughCandidates.length > 0 && Math.random() > 0.3) {
      return toughCandidates[Math.floor(Math.random() * toughCandidates.length)];
    }
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
};