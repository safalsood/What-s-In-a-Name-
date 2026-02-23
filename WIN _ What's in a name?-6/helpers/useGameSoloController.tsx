import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { useCategories } from "./gameQueries";
import { useGameSoloMatch } from "./useGameSoloMatch";
import { useSoloAnalytics } from "./useSoloAnalytics";
import { getPlayerId, getPlayerName } from "./playerInfo";
import { postRecordCategory } from "../endpoints/category/record_POST.schema";
import { generateRoundLetters } from "./gameLogic";
import { stopAllSounds } from "./gameSounds";
import { useGameSoloInit } from "./useGameSoloInit";
import { useGameSoloTimer } from "./useGameSoloTimer";
import { useGameSoloInput } from "./useGameSoloInput";

export function useGameSoloController(miniInputRef: React.RefObject<HTMLInputElement | null>) {
  const playerId = getPlayerId();
  const { isLoading: isLoadingCategories } = useCategories(playerId);
  const { mutateAsync: logAnalytics } = useSoloAnalytics();
  
  const matchState = useGameSoloMatch();
  const {
    gameState,
    setGameState,
    setRoundNumber,
    failedMiniCategories,
    startNewMatch,
    startNewRound,
    handleTimerExpired: matchHandleTimerExpired,
    handleRoundSuccess: matchHandleRoundSuccess,
    baseCategory,
    miniCategoryName,
    letters,
    roundNumber,
    categoriesPlayed
  } = matchState;

  // UI State
  const [showTutorial, setShowTutorial] = useState(false);
  const [showCategoryReveal, setShowCategoryReveal] = useState(false);

  // Refs needed across hooks
  const letterAwardedThisRoundRef = useRef(false);

  // -- Hook: Timer & Sound --
  // We declare the timer hook but need to pass the expiry callback which depends on other functions
  // So we'll define the expiry handler first using a ref to break the dependency cycle or just define the handler.
  // We'll use a forward declaration pattern or simple function definition since hooks need to run in order.
  
  // To avoid circular dependencies between handleTimerExpired and hooks, we'll define a mutable ref for the handler
  // and assign it later.
  const timerExpiredHandlerRef = useRef<() => void>(() => {});

  const { 
    timer, 
    setTimer, 
    borderFlash, 
    setBorderFlash,
    clearTimer
  } = useGameSoloTimer(
    gameState, 
    showCategoryReveal, 
    () => timerExpiredHandlerRef.current()
  );

  // -- Cleanup sounds on unmount --
  useEffect(() => {
    return () => {
      stopAllSounds();
    };
  }, []);

  // -- Forward Declarations --
  const startPlayingDirectly = useCallback(() => {
    setTimer(60);
    inputState.setMiniInputValue("");
    setGameState("playing");
    inputState.setRoundWinner(null);
    inputState.setWinningWord("");
    letterAwardedThisRoundRef.current = false;
    
    if (!showCategoryReveal) {
      setTimeout(() => miniInputRef.current?.focus(), 100);
    }
  }, [showCategoryReveal, setTimer, setGameState]);

  // -- Hook: Initialization --
  const { 
    difficulty, 
    handleTutorialComplete, 
    hasInitializedMatch,
    soloSessionIdRef,
    hasTrackedFirstGrandRef,
    miniCategoriesSeenRef
  } = useGameSoloInit(
    matchState,
    isLoadingCategories,
    startPlayingDirectly,
    setShowCategoryReveal,
    showTutorial,
    setShowTutorial
  );

  const handleCategoryRevealComplete = () => {
    setShowCategoryReveal(false);
    // Ensure input focus after reveal
    setTimeout(() => miniInputRef.current?.focus(), 100);
  };

  const handleRoundSuccess = (winner: "player", letterUsed: string) => {
    const result = matchHandleRoundSuccess(letterUsed);

    setGameState("round-end");
    clearTimer();

    setTimeout(() => {
      setRoundNumber(prev => prev + 1);
      const roundResult = startNewRound(
        result.nextLetters,
        result.updatedUsedMinis,
        failedMiniCategories,
        0
      );
      
      // Analytics: track new mini category seen
      if (soloSessionIdRef.current) {
        miniCategoriesSeenRef.current += 1;
        logAnalytics({
          action: "updateMiniSeen",
          soloSessionId: soloSessionIdRef.current,
          playerId,
          count: miniCategoriesSeenRef.current
        }).catch(e => console.error(e));
      }

      // Go directly to playing for subsequent rounds
      startPlayingDirectly();
    }, 2000);
  };

  const endRound = (winner: "player" | null, letterUsed: string) => {
    if (winner) {
      handleRoundSuccess(winner, letterUsed);
    } else {
      const result = matchHandleRoundSuccess(""); // Empty string for no letter used
      
      setGameState("round-end");
      clearTimer();

      setTimeout(() => {
        setRoundNumber(prev => prev + 1);
        const roundResult = startNewRound(
          result.nextLetters,
          result.updatedUsedMinis,
          failedMiniCategories,
          0
        );

        // Analytics: track new mini category seen
        if (soloSessionIdRef.current) {
          miniCategoriesSeenRef.current += 1;
          logAnalytics({
            action: "updateMiniSeen",
            soloSessionId: soloSessionIdRef.current,
            playerId,
            count: miniCategoriesSeenRef.current
          }).catch(e => console.error(e));
        }

        // Go directly to playing for subsequent rounds
        startPlayingDirectly();
      }, 2000);
    }
  };

  // -- Hook: Input & Validation --
  const inputState = useGameSoloInput(
    matchState,
    miniInputRef,
    showCategoryReveal,
    setBorderFlash,
    handleRoundSuccess,
    setGameState,
    setTimer,
    soloSessionIdRef,
    hasTrackedFirstGrandRef,
    letterAwardedThisRoundRef
  );

  // -- Handlers --
  const handlePass = () => {
    if (gameState !== "playing" && gameState !== "bonus") return;
    
    const newLetters = generateRoundLetters();
    
    startNewRound(
      newLetters,
      matchState.usedMiniCategories,
      matchState.failedMiniCategories,
      0
    );

    // Analytics: track new mini category seen
    if (soloSessionIdRef.current) {
      miniCategoriesSeenRef.current += 1;
      logAnalytics({
        action: "updateMiniSeen",
        soloSessionId: soloSessionIdRef.current,
        playerId,
        count: miniCategoriesSeenRef.current
      }).catch(e => console.error(e));
    }

    setTimer(60);
    inputState.setMiniInputValue("");
    inputState.setRoundWinner(null);
    inputState.setWinningWord("");
    letterAwardedThisRoundRef.current = false;
    toast.info("Passed! New letters and category.", { position: "top-center" });
    
    // Ensure input focus
    setTimeout(() => miniInputRef.current?.focus(), 100);
  };

  const handleTimerExpired = () => {
    if (gameState === "bonus") {
      toast("Bonus time over!", { position: "top-center" });
      endRound(null, "");
      return;
    }

    // Track this as a dead round (fire-and-forget)
    postRecordCategory({
      playerId: getPlayerId(),
      playerName: getPlayerName() || undefined,
      categoryName: matchState.miniCategoryName,
      isBaseCategory: false,
      eventType: "dead_round"
    }).catch(err => console.error("Failed to track dead round:", err));

    const result = matchHandleTimerExpired();
    
    inputState.setRoundWinner(null);
    inputState.setWinningWord("");
    inputState.setUsedLetter("");

    const roundResult = startNewRound(
      result.nextLetters,
      result.updatedUsedMinis,
      result.updatedFailedMinis,
      result.newFailedRounds
    );

    // Analytics: track new mini category seen
    if (soloSessionIdRef.current) {
      miniCategoriesSeenRef.current += 1;
      logAnalytics({
        action: "updateMiniSeen",
        soloSessionId: soloSessionIdRef.current,
        playerId,
        count: miniCategoriesSeenRef.current
      }).catch(e => console.error(e));
    }
    
    // Go directly to playing for subsequent rounds
    startPlayingDirectly();
  };

  // Assign the handler to the ref so the timer hook can call it
  timerExpiredHandlerRef.current = handleTimerExpired;

  const handlePlayAgain = async () => {
    // If abandoning a game that wasn't finished (not game-over), log it as a quit
    if (gameState !== "game-over" && soloSessionIdRef.current) {
       logAnalytics({
          action: "finalize",
          soloSessionId: soloSessionIdRef.current,
          playerId,
          finalLetterCount: inputState.playerLetters.length,
          result: "Quit",
          totalRounds: roundNumber,
          finalGrandWord: undefined,
          possibleGrandWord: undefined
        }).catch(e => console.error(e));
    }

    hasInitializedMatch.current = false; // Reset the flag
    setGameState("loading");
    
    try {
      // Reset analytics state for new match
      soloSessionIdRef.current = nanoid();
      hasTrackedFirstGrandRef.current = false;
      miniCategoriesSeenRef.current = 0;

      // Log Init
      logAnalytics({
        action: "init",
        soloSessionId: soloSessionIdRef.current,
        playerId,
        playerUsername: getPlayerName(),
        gameStartTime: new Date(),
      }).catch(err => console.error("Analytics init failed", err));

      await startNewMatch();

      // Track first mini category seen
      miniCategoriesSeenRef.current += 1;
      logAnalytics({
        action: "updateMiniSeen",
        soloSessionId: soloSessionIdRef.current,
        playerId,
        count: miniCategoriesSeenRef.current
      }).catch(e => console.error(e));

      hasInitializedMatch.current = true;
      
      inputState.setPlayerLetters([]);
      inputState.setUsedLetter("");
      inputState.setGrandWinningWord("");
      setShowCategoryReveal(true);
      startPlayingDirectly();
    } catch (error) {
      console.error("Failed to restart match:", error);
      hasInitializedMatch.current = false;
      toast.error("Failed to start new game. Please try again.", { position: "top-center" });
    }
  };

  // Helper to know if initial data is ready for tutorial rendering
  const isDataReady = !!baseCategory && !!miniCategoryName && letters.length > 0;

  return {
    matchState,
    isLoadingCategories,
    difficulty,
    timer,
    showTutorial,
    showCategoryReveal,
    roundWinner: inputState.roundWinner,
    winningWord: inputState.winningWord,
    usedLetter: inputState.usedLetter,
    playerLetters: inputState.playerLetters,
    miniInputValue: inputState.miniInputValue,
    setMiniInputValue: inputState.setMiniInputValue,
    grandWinningWord: inputState.grandWinningWord,
    borderFlash,
    isDataReady,
    categoriesPlayed: matchState.categoriesPlayed, // Return categoriesPlayed
    
    // Actions
    handleTutorialComplete,
    handleCategoryRevealComplete,
    handleMiniSubmit: inputState.handleMiniSubmit,
    handleGrandSubmit: inputState.handleGrandSubmit,
    handlePlayAgain,
    handlePass,
  };
}