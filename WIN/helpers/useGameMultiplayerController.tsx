import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  useRoomState,
  useStartGame,
  useSubmitWord,
  useShuffleVote,
} from "./roomQueries";
import { playTing, startTickingLoop, stopAllSounds } from "./gameSounds";

const ZapIcon = () => <span style={{ color: "var(--accent)" }}>⚡</span>;

export type GameState =
  | "loading"
  | "tutorial"
  | "intro"
  | "playing"
  | "bonus"
  | "round-end"
  | "game-over";
export type BorderFlash = "gold" | "green" | null;

interface UseGameMultiplayerControllerProps {
  roomCode: string;
  playerId: string;
  miniInputRef: React.RefObject<HTMLInputElement | null>;
}

export function useGameMultiplayerController({
  roomCode,
  playerId,
  miniInputRef,
}: UseGameMultiplayerControllerProps) {
  const { data: roomData, isFetching: isFetchingRoom } = useRoomState(
    roomCode,
    playerId,
  );
  const submitWordMutation = useSubmitWord();
  const shuffleVoteMutation = useShuffleVote();

  const [inputValue, setInputValue] = useState("");
  const [lastRoundWinnerId, setLastRoundWinnerId] = useState<string | null>(
    null,
  );
  const [borderFlash, setBorderFlash] = useState<BorderFlash>(null);
  const [bonusActive, setBonusActive] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const introShownForRoundStart = useRef<string | null>(null);

  const [timer, setTimer] = useState(60);
  const stopTickingRef = useRef<(() => void) | null>(null);
  const timerFrameRef = useRef<number | null>(null);

  const room = roomData?.room;
  const players = roomData?.players || [];
  const currentPlayer = players.find((p) => p.playerId === playerId);
  const otherPlayers = players.filter((p) => p.playerId !== playerId);

  // Derive game state from room data
  const gameState: GameState = (() => {
    if (!room) return "loading";
    if (room.status === "waiting") return "loading"; // Lobby is handled separately
    if (room.status === "tutorial") return "tutorial"; // Tutorial phase - timer not started yet
    if (showIntro) return "intro";
    if (room.status === "finished") return "game-over";
    if (room.roundWinnerId) return "round-end";
    if (bonusActive) return "bonus";
    return "playing";
  })();

  // Handle Intro Sequence Trigger - only show once per unique round start
  useEffect(() => {
    if (!room?.roundStartTime) return;

    // Convert Date to string for consistent comparison
    const startTimeIso =
      typeof room.roundStartTime === "string"
        ? room.roundStartTime
        : room.roundStartTime.toISOString();

    if (
      room.status === "playing" &&
      room.roundNumber === 1 &&
      room.letters &&
      room.letters.length > 0 &&
      introShownForRoundStart.current !== startTimeIso
    ) {
      setShowIntro(true);
      introShownForRoundStart.current = startTimeIso;
    }
  }, [room?.status, room?.roundNumber, room?.roundStartTime, room?.letters]);

  // Sound and Border Flash Effect
  useEffect(() => {
    if (gameState === "playing" || gameState === "bonus") {
      if (!stopTickingRef.current) {
        stopTickingRef.current = startTickingLoop();
      }
      setBorderFlash((curr) => (curr === "green" ? "green" : "gold"));
    } else {
      if (stopTickingRef.current) {
        stopTickingRef.current();
        stopTickingRef.current = null;
      }
      if (gameState !== "round-end") {
        setBorderFlash(null);
      }
    }
  }, [gameState]);

  // Cleanup sounds on unmount
  useEffect(() => {
    return () => {
      stopAllSounds();
      if (timerFrameRef.current) {
        cancelAnimationFrame(timerFrameRef.current);
      }
    };
  }, []);

  // Timer with RAF for smooth updates
  useEffect(() => {
    if (
      (gameState !== "playing" && gameState !== "bonus") ||
      !room?.roundStartTime
    ) {
      setTimer(60);
      if (timerFrameRef.current) {
        cancelAnimationFrame(timerFrameRef.current);
        timerFrameRef.current = null;
      }
      return;
    }

    const startTime = new Date(room.roundStartTime).getTime();

    // Validate startTime is a valid number and not epoch (null date becomes 0)
    if (
      !Number.isFinite(startTime) ||
      Number.isNaN(startTime) ||
      startTime < 1000000000000
    ) {
      console.warn("Invalid roundStartTime, defaulting to 60s timer");
      setTimer(60);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setTimer(remaining);

      if (remaining > 0) {
        timerFrameRef.current = requestAnimationFrame(updateTimer);
      }
    };

    updateTimer();

    return () => {
      if (timerFrameRef.current) {
        cancelAnimationFrame(timerFrameRef.current);
      }
    };
  }, [gameState, room?.roundStartTime]);

  // Round result toast handling
  useEffect(() => {
    if (!room) return;

    // Don't show toast if game is finished (winner screen handles it)
    if (room.status === "finished" && room.roundWinnerId) {
      return;
    }

    if (room.roundWinnerId && room.roundWinnerId !== lastRoundWinnerId) {
      setLastRoundWinnerId(room.roundWinnerId);
      setInputValue("");

      const isMe = room.roundWinnerId === playerId;
      const winnerName =
        players.find((p) => p.playerId === room.roundWinnerId)?.playerName ||
        "Unknown";
      const word = room.roundWinningWord || "???";
      const letter = word.charAt(0).toUpperCase();

      if (isMe) {
        toast.success(`🏆 You won '${letter}' for '${word.toUpperCase()}'`, {
          duration: 2000,
          position: "top-center",
        });
      } else {
        toast.info(
          `🎯 ${winnerName} won '${letter}' for '${word.toUpperCase()}'`,
          {
            duration: 2000,
            position: "top-center",
          },
        );

        // Show Bonus toast only when Bonus Mode is active
        if (room.bonusMode) {
          toast.info(`⚡ Bonus Mode ON for ${winnerName}`, {
            duration: 3000,
            icon: <ZapIcon />,
            position: "top-center",
          });
        }
      }
    }

    // Reset when new round starts
    if (!room.roundWinnerId && lastRoundWinnerId) {
      setLastRoundWinnerId(null);
      setBonusActive(false); // Clear bonus on new round
    }
  }, [room, lastRoundWinnerId, playerId, players]);

  const handleIntroComplete = () => {
    setShowIntro(false);
    setTimeout(() => miniInputRef.current?.focus(), 100);
  };

  const handlePass = async () => {
    if (gameState !== "playing" && gameState !== "bonus") return;

    try {
      // Use shuffle vote with force to pass
      await shuffleVoteMutation.mutateAsync({
        roomCode,
        playerId,
      });

      setInputValue("");
      setBonusActive(false);
      toast.info("Passed! New letters and category coming.", {
        position: "top-center",
      });

      setTimeout(() => miniInputRef.current?.focus(), 100);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to pass", {
        position: "top-center",
      });
    }
  };

  const handleMiniSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const word = inputValue.trim().toLowerCase();

    try {
      const result = await submitWordMutation.mutateAsync({
        roomCode,
        playerId,
        word,
      });

      if (result.success && result.valid) {
        setInputValue("");
        playTing();

        setBorderFlash("green");
        setTimeout(() => {
          setBorderFlash((curr) => (curr === "green" ? "gold" : curr));
        }, 500);

        if (result.isMatchWinner) {
          toast.success("You won the match!", {
            duration: 5000,
            position: "top-center",
          });
          setBonusActive(false);
        } else if (result.isToughLetterBonus) {
          toast.success("Tough Letter Bonus! Submit another word!", {
            duration: 3000,
            icon: <ZapIcon />,
            position: "top-center",
          });
          setBonusActive(true);
        } else {
          // Regular valid word - no toast, the green flash is enough feedback
          if (bonusActive) {
            setBonusActive(false);
          }
        }
      } else if (result.error) {
        toast.error(result.error, { position: "top-center" });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit word",
        { position: "top-center" },
      );
    }
  };

  const handleGrandSubmit = async () => {
    if (!inputValue.trim()) return;

    if (
      !currentPlayer?.collectedLetters ||
      currentPlayer.collectedLetters.length === 0
    ) {
      toast.error("You need to collect some letters first!", {
        position: "top-center",
      });
      return;
    }

    const word = inputValue.trim().toUpperCase();
    const wordLetters = word.split("");
    const availableLetters = [...currentPlayer.collectedLetters];

    let validLetters = true;

    for (const letter of wordLetters) {
      const index = availableLetters.indexOf(letter);
      if (index === -1) {
        validLetters = false;
        break;
      }
      availableLetters.splice(index, 1);
    }

    if (!validLetters) {
      toast.error("Grand word can only use letters you have collected!", {
        position: "top-center",
      });
      return;
    }

    if (word.length < 4) {
      toast.error("Grand word must be at least 4 letters long!", {
        position: "top-center",
      });
      return;
    }

    try {
      const result = await submitWordMutation.mutateAsync({
        roomCode,
        playerId,
        word: word.toLowerCase(),
        isGrandSubmit: true,
      });

      if (result.success && result.valid) {
        setInputValue("");
        playTing();
        if (result.isMatchWinner) {
          toast.success("You won the match!", { position: "top-center" });
        }
      } else if (result.error) {
        toast.error(result.error, { position: "top-center" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Validation error", {
        position: "top-center",
      });
    }
  };

  return {
    // Data
    roomData,
    room,
    players,
    currentPlayer,
    otherPlayers,
    isFetchingRoom,

    // State
    gameState,
    inputValue,
    setInputValue,
    borderFlash,
    bonusActive,
    showIntro,
    timer,

    // Actions
    handleIntroComplete,
    handlePass,
    handleMiniSubmit,
    handleGrandSubmit,

    // Mutations
    isSubmitting: submitWordMutation.isPending,
  };
}
