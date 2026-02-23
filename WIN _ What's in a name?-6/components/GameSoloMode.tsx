import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { Button } from "./Button";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import { GameTutorial } from "./GameTutorial";
import { GameWinnerScreen } from "./GameWinnerScreen";
import { GameLettersDisplay } from "./GameLettersDisplay";
import { LoadingQuotes } from "./LoadingQuotes";
import { GameCategoryReveal } from "./GameCategoryReveal";
import { GameBottomSection } from "./GameBottomSection";
import { useGameSoloController } from "../helpers/useGameSoloController";
import { useIsMobile } from "../helpers/useIsMobile";
import { useDoubleTapKeyboard } from "../helpers/useDoubleTapKeyboard";
import { getPlayerId } from "../helpers/playerInfo";
import { useEffect } from "react";
import styles from "./GameSoloMode.module.css";

export function GameSoloMode() {
  // Tutorial refs
  const roundRef = useRef<HTMLSpanElement>(null);
  const timerElementRef = useRef<HTMLDivElement>(null);
  const lettersRef = useRef<HTMLDivElement>(null);
  const miniCategoryRef = useRef<HTMLDivElement>(null);
  const inputSectionRef = useRef<HTMLFormElement>(null);
  const submitMiniRef = useRef<HTMLButtonElement>(null);
  const baseCategoryRef = useRef<HTMLDivElement>(null);
  const ownedLettersRef = useRef<HTMLDivElement>(null);
  const submitGrandRef = useRef<HTMLButtonElement>(null);
  
  // Logic refs
  const miniInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [showExitDialog, setShowExitDialog] = useState(false);
  const isMobile = useIsMobile();
  const { isKeyboardVisible, inputProps: keyboardInputProps } = useDoubleTapKeyboard({ ref: miniInputRef, isMobile });

  const {
    matchState,
    isLoadingCategories,
    timer,
    showTutorial,
    showCategoryReveal,
    roundWinner,
    winningWord,
    playerLetters,
    miniInputValue,
    setMiniInputValue,
    grandWinningWord,
    borderFlash,
    isDataReady,
    handleTutorialComplete,
    handleCategoryRevealComplete,
    handleMiniSubmit,
    handleGrandSubmit,
    handlePlayAgain,
    handlePass,
    categoriesPlayed,
  } = useGameSoloController(miniInputRef);

  const {
    gameState,
    roundNumber,
    letters,
    baseCategory,
    miniCategoryName,
    roundKey,
  } = matchState;

  // Lock body scroll when game is playing
  useEffect(() => {
    // We lock it for the entire duration of this component being mounted essentially,
    // or specifically when not in loading/intro states if we want to be precise,
    // but the request asks to lock it when game is playing.
    // However, looking at GameMultiplayerMode reference, it locks on mount/unmount logic
    // or specific game states.
    // Let's lock it whenever we are in the main game view (not loading).

    if (gameState !== "loading" && gameState !== "intro") {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.height = "100%";
      document.body.style.overscrollBehavior = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
      document.body.style.overscrollBehavior = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
      document.body.style.overscrollBehavior = "";
    };
  }, [gameState]);

  // Sync readOnly attribute based on keyboard visibility
  useEffect(() => {
    if (isMobile && miniInputRef.current) {
      miniInputRef.current.readOnly = !isKeyboardVisible;
    }
  }, [isMobile, isKeyboardVisible]);

  // Render Logic
  // Show loading if categories are loading, 
  // OR if game is loading and we are NOT in tutorial (waiting for intro)
  // OR if game is loading and we ARE in tutorial but data isn't ready yet
  const showLoading = isLoadingCategories || 
    (gameState === "loading" && !showTutorial) ||
    (gameState === "loading" && showTutorial && !isDataReady);

  // Show reveal over everything else if active, unless loading
  const shouldShowReveal = showCategoryReveal && !showLoading && gameState !== "loading";

  if (showLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingContent}>
          <LoadingQuotes />
          <div className={styles.skeletons}>
            <Skeleton className={styles.skeletonLetter} />
            <Skeleton className={styles.skeletonLetter} />
            <Skeleton className={styles.skeletonLetter} />
            <Skeleton className={styles.skeletonLetter} />
            <Skeleton className={styles.skeletonLetter} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exit Game?</DialogTitle>
            <DialogDescription>
              Are you sure you want to exit? Your progress will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowExitDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => navigate("/")}>
              Exit Game
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {shouldShowReveal && (
        <GameCategoryReveal
          category={baseCategory}
          onComplete={handleCategoryRevealComplete}
        />
      )}

      {showTutorial && (
        <GameTutorial
          onComplete={handleTutorialComplete}
        />
      )}

      {gameState === "game-over" && (
        <GameWinnerScreen
          winningWord={grandWinningWord}
          baseCategory={baseCategory}
          roundsPlayed={roundNumber}
          onPlayAgain={handlePlayAgain}
          playerId={getPlayerId()}
          isWinner={true}
          soloMissedWordsData={{
            baseCategory,
            collectedLetters: playerLetters,
            categoriesPlayed,
          }}
        />
      )}

      {gameState !== "intro" && gameState !== "game-over" && (
        <div
          className={styles.container}
          data-flash={borderFlash}
          data-keyboard-mode={isMobile && isKeyboardVisible}
          // Hide from screen readers / focus when tutorial is active
          aria-hidden={showTutorial}
          inert={showTutorial ? true : undefined}
        >
          <header className={styles.header}>
            <div className={styles.headerLeft}>
              <Button
                variant="ghost"
                size="icon-sm"
                className={styles.exitButton}
                onClick={() => setShowExitDialog(true)}
                aria-label="Exit Game"
              >
                <X size={20} />
              </Button>
              <span ref={roundRef} className={styles.roundBadge}>
                Round {roundNumber}
              </span>
            </div>

            <div className={styles.headerRight}>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePass}
                className={styles.passButton}
                disabled={gameState !== "playing" && gameState !== "bonus"}
              >
                Pass
              </Button>
              <div
                ref={timerElementRef}
                className={styles.timer}
                data-urgent={timer <= 10}
              >
                <span>
                  {String(Math.floor(timer / 60)).padStart(2, "0")}:
                  {String(timer % 60).padStart(2, "0")}
                </span>
              </div>
            </div>
          </header>

          <main className={styles.main}>
            <div
              ref={miniCategoryRef}
              className={styles.miniCategorySection}
              data-keyboard-mode={isMobile && isKeyboardVisible}
            >
              <div className={styles.categoryLabel}>✦ Mini Category ✦</div>
              <div
                key={`category-${roundKey}`}
                className={styles.categoryValue}
              >
                {miniCategoryName}
              </div>
            </div>

            <GameLettersDisplay
              ref={lettersRef}
              letters={letters}
              roundNumber={roundNumber}
              layout={isMobile && isKeyboardVisible ? "row" : "pyramid"}
            />
          </main>

          <GameBottomSection
            inputValue={miniInputValue}
            onInputChange={setMiniInputValue}
            onMiniSubmit={handleMiniSubmit}
            onGrandSubmit={handleGrandSubmit}
            baseCategory={baseCategory}
            currentPlayerLetters={playerLetters}
            bonusActive={gameState === "bonus"}
            isGameFinished={gameState === "round-end"}
            onInputFocus={keyboardInputProps.onFocus}
            onInputBlur={keyboardInputProps.onBlur}
            onInputTouchStart={keyboardInputProps.onTouchStart}
            inputRef={miniInputRef}
            inputSectionRef={inputSectionRef}
            submitMiniRef={submitMiniRef}
            baseCategoryRef={baseCategoryRef}
            ownedLettersRef={ownedLettersRef}
            submitGrandRef={submitGrandRef}
            isKeyboardMode={isMobile && isKeyboardVisible}
          />
        </div>
      )}
    </>
  );
}