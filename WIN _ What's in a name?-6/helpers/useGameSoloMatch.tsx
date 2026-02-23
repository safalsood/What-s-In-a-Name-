import { useState } from "react";
import { toast } from "sonner";
import { generateRoundLetters } from "./gameLogic";
import { postSelectCategory } from "../endpoints/categories/select_POST.schema";
import { getPlayerId, getPlayerName } from "./playerInfo";

export type GameState = "loading" | "intro" | "playing" | "bonus" | "round-end" | "game-over";

export interface CategoryPlayed {
  category: string;
  letters: string[];
}

export function useGameSoloMatch() {
  const playerId = getPlayerId();

  const [gameState, setGameState] = useState<GameState>("loading");
  const [roundNumber, setRoundNumber] = useState(1);
  const [failedRounds, setFailedRounds] = useState(0);

  const [letters, setLetters] = useState<string[]>([]);
  
  // Category State
  const [baseCategory, setBaseCategory] = useState<string>("");
  const [miniCategoryName, setMiniCategoryName] = useState<string>("");
  const [miniCategoryId, setMiniCategoryId] = useState<string>("");
  
  // Tracking History for Intelligent Selection
  const [usedMiniCategories, setUsedMiniCategories] = useState<string[]>([]);
  const [failedMiniCategories, setFailedMiniCategories] = useState<string[]>([]);
  const [playerCategoryHistory, setPlayerCategoryHistory] = useState<string[]>([]);
  const [categoriesPlayed, setCategoriesPlayed] = useState<CategoryPlayed[]>([]);

  const [roundKey, setRoundKey] = useState(0);
  const [usedWords, setUsedWords] = useState<Record<string, string[]>>({});

  const startNewMatch = async () => {
    // Select base category via endpoint (also tracks usage in DB)
    const baseCatResult = await postSelectCategory({
      type: "base",
      playerId,
      playerName: getPlayerName() || undefined
    });
    
    const newLetters = generateRoundLetters();
    
    // First mini category selection via endpoint (also tracks usage in DB)
    const miniCatResult = await postSelectCategory({
      type: "mini",
      playerId,
      playerName: getPlayerName() || undefined,
      currentLetters: newLetters,
      usedMiniCategoryIds: [],
      failedMiniCategoryIds: [],
      consecutiveFailures: 0,
      baseCategory: baseCatResult.categoryId
    });

    // Update local session history for immediate freshness
    setPlayerCategoryHistory(prev => [...prev, baseCatResult.categoryName, miniCatResult.categoryName]);

    setBaseCategory(baseCatResult.categoryName);
    setMiniCategoryName(miniCatResult.categoryName);
    setMiniCategoryId(miniCatResult.categoryId);
    
    setLetters(newLetters);
    setRoundNumber(1);
    
    // Reset history tracking
    setFailedRounds(0);
    setUsedMiniCategories([]);
    setFailedMiniCategories([]);
    setCategoriesPlayed([{ category: miniCatResult.categoryName, letters: newLetters }]);
    
    setUsedWords({});
    setRoundKey(0);

    return {
      baseCategoryName: baseCatResult.categoryName,
      miniCategoryName: miniCatResult.categoryName,
      letters: newLetters
    };
  };

  const startNewRound = async (
    currentLetters: string[],
    currentUsedMinis: string[],
    currentFailedMinis: string[],
    currentFailCount: number
  ) => {
    // Select new mini category via endpoint (also tracks usage in DB)
    const miniCatResult = await postSelectCategory({
      type: "mini",
      playerId,
      playerName: getPlayerName() || undefined,
      currentLetters: currentLetters,
      usedMiniCategoryIds: currentUsedMinis,
      failedMiniCategoryIds: currentFailedMinis,
      consecutiveFailures: currentFailCount,
      baseCategory: baseCategory
    });

    // Update local session history for immediate freshness
    setPlayerCategoryHistory(prev => [...prev, miniCatResult.categoryName]);

    setMiniCategoryName(miniCatResult.categoryName);
    setMiniCategoryId(miniCatResult.categoryId);
    setRoundKey(prev => prev + 1);
    setLetters(currentLetters);
    setCategoriesPlayed(prev => [...prev, { category: miniCatResult.categoryName, letters: currentLetters }]);

    return {
      miniCategoryName: miniCatResult.categoryName,
      letters: currentLetters
    };
  };

  const handleTimerExpired = () => {
    // Update failure tracking
    const newFailedRounds = failedRounds + 1;
    setFailedRounds(newFailedRounds);

    const updatedUsedMinis = [...usedMiniCategories, miniCategoryId];
    setUsedMiniCategories(updatedUsedMinis);

    const updatedFailedMinis = [...failedMiniCategories, miniCategoryId];
    setFailedMiniCategories(updatedFailedMinis);

    // Logic for next round's letters
    let nextLetters = letters;
    if (newFailedRounds >= 3) {
      toast.warning("3 Failed Rounds! Regenerating letters for better luck...");
      setFailedRounds(0); 
      nextLetters = generateRoundLetters();
    }

    return {
      nextLetters,
      updatedUsedMinis,
      updatedFailedMinis,
      newFailedRounds
    };
  };

  const handleRoundSuccess = (letterUsed: string) => {
    // Reset consecutive failures on success
    setFailedRounds(0);
    
    // Add to used but NOT failed
    const updatedUsedMinis = [...usedMiniCategories, miniCategoryId];
    setUsedMiniCategories(updatedUsedMinis);

    // Determine next letters
    const nextLetters = generateRoundLetters();

    return {
      nextLetters,
      updatedUsedMinis
    };
  };

  return {
    gameState,
    setGameState,
    roundNumber,
    setRoundNumber,
    failedRounds,
    letters,
    setLetters,
    baseCategory,
    miniCategoryName,
    miniCategoryId,
    usedMiniCategories,
    failedMiniCategories,
    playerCategoryHistory,
    categoriesPlayed,
    roundKey,
    usedWords,
    setUsedWords,
    startNewMatch,
    startNewRound,
    handleTimerExpired,
    handleRoundSuccess,
  };
}