import { useEffect, useRef, useState } from "react";
import { startTickingLoop } from "./gameSounds";
import { GameState } from "./useGameSoloMatch";

export type BorderFlash = "gold" | "green" | null;

export function useGameSoloTimer(
  gameState: GameState,
  showCategoryReveal: boolean,
  onTimerExpired: () => void
) {
  const [timer, setTimer] = useState(60);
  const [borderFlash, setBorderFlash] = useState<BorderFlash>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stopTickingRef = useRef<(() => void) | null>(null);

  // Sound effects & Ticking
  useEffect(() => {
    if ((gameState === "playing" || gameState === "bonus") && !showCategoryReveal) {
      if (!stopTickingRef.current) {
        stopTickingRef.current = startTickingLoop();
      }
      setBorderFlash("gold");
    } else {
      if (stopTickingRef.current) {
        stopTickingRef.current();
        stopTickingRef.current = null;
      }
      if (gameState !== "round-end") {
        setBorderFlash(null);
      }
    }

    return () => {
      if (stopTickingRef.current) {
        stopTickingRef.current();
        stopTickingRef.current = null;
      }
    };
  }, [gameState, showCategoryReveal]);

  // Timer Logic
  useEffect(() => {
    if ((gameState === "playing" || gameState === "bonus") && timer > 0 && !showCategoryReveal) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0 && (gameState === "playing" || gameState === "bonus")) {
      onTimerExpired();
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, timer, showCategoryReveal]);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return {
    timer,
    setTimer,
    borderFlash,
    setBorderFlash,
    clearTimer
  };
}