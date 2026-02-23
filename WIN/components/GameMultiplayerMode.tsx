import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "./Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { GameLobby } from "./GameLobby";
import { GameTutorial } from "./GameTutorial";
import { TutorialWaitingScreen } from "./TutorialWaitingScreen";
import { GameCategoryReveal } from "./GameCategoryReveal";
import { GameLettersDisplay } from "./GameLettersDisplay";
import { GameWinnerScreen } from "./GameWinnerScreen";
import { GameMultiplayerHeader } from "./GameMultiplayerHeader";
import { GameBottomSection } from "./GameBottomSection";
import { LoadingQuotes } from "./LoadingQuotes";
import { Skeleton } from "./Skeleton";
import { useStartGame, useTutorialComplete, useFlushLogs, usePlayAgain } from "../helpers/roomQueries";
import { useGameMultiplayerController } from "../helpers/useGameMultiplayerController";
import { useIsMobile } from "../helpers/useIsMobile";
import { useDoubleTapKeyboard } from "../helpers/useDoubleTapKeyboard";
import { useAuth } from "../helpers/useAuth";
import { toast } from "sonner";
import { X } from "lucide-react";
import styles from "./GameMultiplayerMode.module.css";

interface GameMultiplayerModeProps {
  roomCode: string;
  playerId: string;
}

export function GameMultiplayerMode({
  roomCode,
  playerId,
}: GameMultiplayerModeProps) {
  const startGameMutation = useStartGame();
  const playAgainMutation = usePlayAgain();
  const tutorialCompleteMutation = useTutorialComplete();
  const flushLogsMutation = useFlushLogs();
  const { authState } = useAuth();

  const [showExitDialog, setShowExitDialog] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => {
    // Initialize based on localStorage - new players should see tutorial immediately
    const completed = localStorage.getItem("word-challenge-tutorial-completed");
    return !completed;
  });
  const isMobile = useIsMobile();

  // Tutorial refs
  const roundRef = useRef<HTMLSpanElement>(null);
  const timerElementRef = useRef<HTMLDivElement>(null);
  const lettersRef = useRef<HTMLDivElement>(null);
  const miniCategoryRef = useRef<HTMLDivElement>(null);
  const inputSectionRef = useRef<HTMLFormElement>(null);
  const submitMiniRef = useRef<HTMLButtonElement>(null);
  const baseCategoryRef = useRef<HTMLDivElement>(null);
  const previousBaseCategoryRef = useRef<string | null>(null);
  const ownedLettersRef = useRef<HTMLDivElement>(null);
  const submitGrandRef = useRef<HTMLButtonElement>(null);
  const miniInputRef = useRef<HTMLInputElement>(null);

  const { isKeyboardVisible, inputProps: keyboardInputProps } = useDoubleTapKeyboard({ ref: miniInputRef, isMobile });

  const controller = useGameMultiplayerController({
    roomCode,
    playerId,
    miniInputRef,
  });

  const {
    roomData,
    room,
    currentPlayer,
    otherPlayers,
    isFetchingRoom,
    gameState,
    inputValue,
    setInputValue,
    borderFlash,
    bonusActive,
    showIntro,
    timer,
    handleIntroComplete,
    handlePass,
    handleMiniSubmit,
    handleGrandSubmit,
    isSubmitting,
  } = controller;

  // Lock body scroll when game is playing
  useEffect(() => {
    if (gameState === "playing" || gameState === "bonus") {
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

  useEffect(() => {
    if (typeof room === "undefined" || !room?.baseCategory) return;

    // Stop animation loop if category didn't change
    if (previousBaseCategoryRef.current === room.baseCategory) {
      return;
    }

    previousBaseCategoryRef.current = room.baseCategory;

    if (baseCategoryRef.current) {
      baseCategoryRef.current.classList.remove("animate");
      void baseCategoryRef.current.offsetWidth;
      baseCategoryRef.current.classList.add("animate");
    }
  }, [room?.baseCategory]);

  // Flush pending logs when multiplayer game ends
  useEffect(() => {
    console.log("[FlushLogs] Effect triggered - room?.status:", room?.status, "roomCode:", roomCode);
    
    if (room?.status === "finished" && roomCode) {
      console.log("[FlushLogs] Condition met - about to call flushLogsMutation.mutate for room:", roomCode);
      // Fire and forget - don't block the UI
      flushLogsMutation.mutate(
        { roomCode },
        {
          onSuccess: (data) => {
            console.log(
              `[FlushLogs] Successfully flushed ${data.logsProcessed} pending logs for room ${roomCode}`,
            );
          },
          onError: (error) => {
            console.error(
              `[FlushLogs] Failed to flush logs for room ${roomCode}:`,
              error,
            );
          },
        },
      );
    }
    // We only want this to run when status changes to finished
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, roomCode]);

  // Effect to handle tutorial completion syncing when in tutorial mode
  useEffect(() => {
    if (room?.status !== "tutorial") return;

    const localTutorialCompleted = localStorage.getItem(
      "word-challenge-tutorial-completed",
    );

    // If locally we know we finished the tutorial, but server doesn't know, tell the server
    if (localTutorialCompleted && currentPlayer && !currentPlayer.tutorialComplete) {
      tutorialCompleteMutation.mutate({ roomCode, playerId });
    }
  }, [room?.status, currentPlayer?.tutorialComplete, roomCode, playerId]);

  useEffect(() => {
    if (isMobile && miniInputRef.current) {
      miniInputRef.current.readOnly = !isKeyboardVisible;
    }
  }, [isMobile, isKeyboardVisible]);

  const handleTutorialComplete = async () => {
    localStorage.setItem("word-challenge-tutorial-completed", "true");
    setShowTutorial(false);

    try {
      await tutorialCompleteMutation.mutateAsync({ roomCode, playerId });
    } catch (error) {
      console.error("Failed to mark tutorial complete:", error);
    }
  };

  const handleSkipTutorialWait = async () => {
    try {
      // First mark current player's tutorial complete if not already
      if (currentPlayer && !currentPlayer.tutorialComplete) {
        localStorage.setItem("word-challenge-tutorial-completed", "true");
        await tutorialCompleteMutation.mutateAsync({ roomCode, playerId });
      }
      
      // Then start the game - backend will force all tutorials complete
      await startGameMutation.mutateAsync({ roomCode, playerId });
      toast.success("Starting game!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start game",
      );
    }
  };

  const handleStartGame = async () => {
    try {
      await startGameMutation.mutateAsync({ roomCode, playerId });
      toast.success("Game started!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start game",
      );
    }
  };

  const handlePlayAgain = async () => {
    setIsRestarting(true);
    try {
      await playAgainMutation.mutateAsync({ roomCode, playerId });
      toast.success("Returning to lobby...");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reset room",
      );
    } finally {
      setIsRestarting(false);
    }
  };

  // Loading state
  if (isFetchingRoom && !roomData) {
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

  // Room not found
  if (!roomData || !room) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingContent}>
          <h2 className={styles.loadingTitle}>Room not found</h2>
          <Button asChild>
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Lobby/Waiting state
  if (room.status === "waiting") {
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
              <Button
                variant="secondary"
                onClick={() => setShowExitDialog(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" asChild>
                <Link to="/">Exit Game</Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <header className={styles.header}>
          <Button
            variant="ghost"
            size="icon-sm"
            className={styles.exitButton}
            onClick={() => setShowExitDialog(true)}
            aria-label="Exit Game"
          >
            <X size={20} />
          </Button>
        </header>
        <GameLobby
          room={room}
          players={roomData.players}
          playerId={playerId}
          userId={
            authState.type === "authenticated" ? authState.user.id : undefined
          }
          onStartGame={handleStartGame}
          isStarting={startGameMutation.isPending}
        />
      </>
    );
  }

  // Game Over - Use GameWinnerScreen component
  if (gameState === "game-over" && room.roundWinnerId) {
    const matchWinner = roomData.players.find(
      (p) => p.playerId === room.roundWinnerId,
    );
    const isPlayerWinner = room.roundWinnerId === playerId;

    return (
            <GameWinnerScreen
        winningWord={room.roundWinningWord || "VICTORY"}
        baseCategory={room.baseCategory || ""}
        roundsPlayed={room.roundNumber}
        onPlayAgain={handlePlayAgain}
        isWinner={isPlayerWinner}
        winnerName={matchWinner?.playerName}
        roomCode={roomCode}
        playerId={playerId}
      />
    );
  }

  // Main Game View
  return (
    <div
      className={styles.gameScreen}
      onTouchStart={(e) => {
        const target = e.target as HTMLElement;
        const isInteractive =
          target.tagName === "INPUT" ||
          target.tagName === "BUTTON" ||
          target.tagName === "A" ||
          target.closest("button") ||
          target.closest("a");

        if (!isInteractive) {
          e.preventDefault();
        }
      }}
    >
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exit Game?</DialogTitle>
            <DialogDescription>
              Are you sure you want to exit? Your progress will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setShowExitDialog(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" asChild>
              <Link to="/">Exit Game</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showIntro && (
        <GameCategoryReveal
          category={room.baseCategory || "Unknown"}
          onComplete={handleIntroComplete}
        />
      )}

      {/* Tutorial Overlay */}
      {showTutorial && (
        <GameTutorial
          onComplete={handleTutorialComplete}
        />
      )}

      {/* Waiting for others to finish tutorial */}
      {room.status === "tutorial" && !showTutorial && (() => {
        const playersNeedingTutorial = roomData.players.filter(p => !p.tutorialComplete).length;
        const isHost = room.hostId === playerId;
        
        return (
          <TutorialWaitingScreen 
            onViewTutorial={() => setShowTutorial(true)}
            isHost={isHost}
            onSkipTutorialWait={handleSkipTutorialWait}
            playersNeedingTutorial={playersNeedingTutorial}
            totalPlayers={roomData.players.length}
          />
        );
      })()}

      <div
        className={styles.container}
        data-flash={borderFlash}
        data-keyboard-mode={isMobile && isKeyboardVisible}
        aria-hidden={showTutorial || showIntro || (room.status === "tutorial" && !showTutorial)}
        inert={showTutorial || showIntro || (room.status === "tutorial" && !showTutorial) ? true : undefined}
      >
        <GameMultiplayerHeader
          roomCode={roomCode}
          roundNumber={room.roundNumber}
          timer={timer}
          onExit={() => setShowExitDialog(true)}
          onPass={handlePass}
          canPass={gameState === "playing" || gameState === "bonus"}
          roundRef={roundRef}
          timerRef={timerElementRef}
        />

        <main className={styles.main}>
          <div
            ref={miniCategoryRef}
            className={styles.miniCategorySection}
            data-keyboard-mode={isMobile && isKeyboardVisible}
          >
            <div className={styles.categoryLabel}>✦ Mini Category ✦</div>
            <div
              key={`category-${room.roundNumber}`}
              className={styles.categoryValue}
            >
              {room.currentMiniCategory}
            </div>
          </div>

          <GameLettersDisplay
            ref={lettersRef}
            letters={room.letters || []}
            roundNumber={room.roundNumber}
            layout={isMobile && isKeyboardVisible ? "row" : "pyramid"}
          />
        </main>

        <GameBottomSection
          inputValue={inputValue}
          onInputChange={setInputValue}
          onMiniSubmit={handleMiniSubmit}
          onGrandSubmit={handleGrandSubmit}
          baseCategory={room.baseCategory || "Loading..."}
          currentPlayerLetters={currentPlayer?.collectedLetters || []}
          otherPlayers={otherPlayers}
          bonusActive={bonusActive}
          isSubmitting={isSubmitting}
          isGameFinished={room.status === "finished"}
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
    </div>
  );
}
