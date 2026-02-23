import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { getPlayerId, getPlayerName } from "./playerInfo";
import { useSoloAnalytics } from "./useSoloAnalytics";
import { useGameSoloMatch } from "./useGameSoloMatch";
import { getSettings, Difficulty } from "./gameLogic";

const TUTORIAL_STORAGE_KEY = "word-challenge-tutorial-completed";

export function useGameSoloInit(
  matchState: ReturnType<typeof useGameSoloMatch>,
  isLoadingCategories: boolean,
  startPlayingDirectly: () => void,
  setShowCategoryReveal: (show: boolean) => void,
  showTutorial: boolean,
  setShowTutorial: (show: boolean) => void
) {
  const playerId = getPlayerId();
  const { mutateAsync: logAnalytics } = useSoloAnalytics();

  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const hasInitializedMatch = useRef(false);
  const soloSessionIdRef = useRef<string | null>(null);
  const hasTrackedFirstGrandRef = useRef(false);
  const miniCategoriesSeenRef = useRef(0);

  const { gameState, startNewMatch } = matchState;

  // Initialize Settings & Tutorial Check
  useEffect(() => {
    const settings = getSettings();
    setDifficulty(settings.difficulty);

    const tutorialCompleted = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!tutorialCompleted) {
      setShowTutorial(true);
    }
  }, []);

  // Initialize Match
  useEffect(() => {
    async function initMatch() {
      if (isLoadingCategories) return;
      if (hasInitializedMatch.current) return; // Already initialized

      if (gameState === "loading") {
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

          if (!showTutorial) {
            // Normal flow: start match then go to category reveal
            await startNewMatch();
            
            // Increment seen count for first mini category
            miniCategoriesSeenRef.current += 1;
            logAnalytics({
              action: "updateMiniSeen",
              soloSessionId: soloSessionIdRef.current,
              playerId,
              count: miniCategoriesSeenRef.current
            }).catch(e => console.error(e));

            hasInitializedMatch.current = true; // Mark as initialized ONLY on success
            setShowCategoryReveal(true);
            startPlayingDirectly();
          } else {
            // Tutorial flow: start match to populate data, but don't go to intro yet.
            // The view will render the game UI in a static state for tutorial.
            await startNewMatch();
            // Note: We might want to avoid logging 'seen' for tutorial until they actually start playing, 
            // but for simplicity we treat it as part of the session data.
            miniCategoriesSeenRef.current += 1;
            
            hasInitializedMatch.current = true; // Mark as initialized ONLY on success
          }
        } catch (error) {
          console.error("Failed to start match:", error);
          hasInitializedMatch.current = false; // Reset on failure
          toast.error("Failed to start game. Please try again.", {
            position: "top-center",
            action: {
              label: "Retry",
              onClick: () => {
                hasInitializedMatch.current = false;
                window.location.reload(); 
              }
            }
          });
        }
      }
    }

    initMatch();
  }, [isLoadingCategories, gameState, showTutorial]);

  const handleTutorialComplete = () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
    setShowTutorial(false);
    // Start the reveal sequence now that tutorial is done
    setShowCategoryReveal(true);
    startPlayingDirectly();
  };

  return {
    difficulty,
    handleTutorialComplete,
    hasInitializedMatch,
    soloSessionIdRef,
    hasTrackedFirstGrandRef,
    miniCategoriesSeenRef
  };
}