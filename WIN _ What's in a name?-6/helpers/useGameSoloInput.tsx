import { useState, useRef } from "react";
import { toast } from "sonner";
import { useValidateWord } from "./gameQueries";
import { useGameSoloMatch } from "./useGameSoloMatch";
import { TOUGH_LETTERS } from "./gameLogic";
import { playTing } from "./gameSounds";
import { BorderFlash } from "./useGameSoloTimer";
import { getPlayerId } from "./playerInfo";
import { useSoloAnalytics } from "./useSoloAnalytics";

const ZapIcon = () => <span style={{ color: "var(--accent)" }}>⚡</span>;

export function useGameSoloInput(
  matchState: ReturnType<typeof useGameSoloMatch>,
  miniInputRef: React.RefObject<HTMLInputElement | null>,
  showCategoryReveal: boolean,
  setBorderFlash: (flash: BorderFlash) => void,
  handleRoundSuccess: (winner: "player", letterUsed: string) => void,
  setGameState: (state: any) => void,
  setTimer: (time: number) => void,
  soloSessionIdRef: React.MutableRefObject<string | null>,
  hasTrackedFirstGrandRef: React.MutableRefObject<boolean>,
  letterAwardedThisRoundRef: React.MutableRefObject<boolean>
) {
  const playerId = getPlayerId();
  const validateWordMutation = useValidateWord();
  const { mutateAsync: logAnalytics } = useSoloAnalytics();

  const [miniInputValue, setMiniInputValue] = useState("");
  const [playerLetters, setPlayerLetters] = useState<string[]>([]);
  const [grandWinningWord, setGrandWinningWord] = useState<string>("");
  
  const [roundWinner, setRoundWinner] = useState<"player" | null>(null);
  const [winningWord, setWinningWord] = useState<string>("");
  const [usedLetter, setUsedLetter] = useState<string>("");

  const {
    gameState,
    letters,
    miniCategoryName,
    usedWords,
    setUsedWords,
    baseCategory,
    roundNumber
  } = matchState;

  const handleMiniSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (showCategoryReveal) return; // Block input during reveal

    if (!miniInputValue.trim()) return;

    const word = miniInputValue.trim().toUpperCase();
    const firstChar = word.charAt(0);

    if (!letters.includes(firstChar)) {
      toast.error(`Word must start with one of the available letters!`, { position: "top-center" });
      return;
    }

    if (usedWords[miniCategoryName]?.includes(word)) {
      toast.error("Word already used in this category!", { position: "top-center" });
      return;
    }

    try {
      const result = await validateWordMutation.mutateAsync({
        word,
        category: miniCategoryName,
        allowedLetters: letters,
        usedWords: usedWords[miniCategoryName] || []
      });

      if (!result.valid) {
        toast.error(result.rejectionReason || "Not a valid English word!", { position: "top-center" });
        return;
      }

      if (result.fitsCategory === false) {
        toast.error(result.rejectionReason || `"${word}" doesn't fit the category "${miniCategoryName}"!`, { position: "top-center" });
        return;
      }

      playTing();

      setBorderFlash("green");
      setTimeout(() => {
        setBorderFlash("gold");
      }, 500);

      setUsedWords(prev => ({
        ...prev,
        [miniCategoryName]: [...(prev[miniCategoryName] || []), word]
      }));
      
      // Clear input but keep focus
      setMiniInputValue("");
      setTimeout(() => miniInputRef.current?.focus(), 50);

      const isTough = TOUGH_LETTERS.includes(firstChar);

      if (gameState === "playing") {
        if (letterAwardedThisRoundRef.current) {
           toast.info(`Valid word '${word}'! But you already got a letter this round.`);
           return;
        }

        setPlayerLetters(prev => [...prev, firstChar]);
        letterAwardedThisRoundRef.current = true;

        if (isTough) {
          setGameState("bonus");
          setTimer(15);
          // Only change letters in match state via setGameState if needed, but here we likely need to handle it in controller or pass setLetters.
          // However, matchState exposes setLetters.
          matchState.setLetters(prev => prev.filter(l => l !== firstChar));
          
          // Reset award flag for the bonus round so they can get another letter
          letterAwardedThisRoundRef.current = false;

          toast.success("Tough Letter! +15s Bonus! Find another word!", {
            duration: 3000,
            icon: <ZapIcon />,
            position: "top-center"
          });
        } else {
          setRoundWinner("player");
          setWinningWord(word);
          setUsedLetter(firstChar);
          handleRoundSuccess("player", firstChar);
          
          toast.success(`🏆 You won '${firstChar}' for '${word}'`, {
            duration: 2000,
            position: "top-center",
          });
        }
      } else if (gameState === "bonus") {
        if (letterAwardedThisRoundRef.current) {
           toast.info(`Valid word '${word}'! But you already got a letter this round.`);
           return;
        }

        setPlayerLetters(prev => [...prev, firstChar]);
        letterAwardedThisRoundRef.current = true;
        
        setRoundWinner("player");
        setWinningWord(word);
        setUsedLetter(firstChar);
        handleRoundSuccess("player", firstChar);
        
        toast.success(`🏆 You won '${firstChar}' for '${word}'`, {
          duration: 2000,
          position: "top-center",
        });
      }

    } catch (error) {
      toast.error("Validation failed. Please try again.", { position: "top-center" });
    }
  };

  const handleGrandSubmit = async () => {
    if (showCategoryReveal) return; // Block input during reveal
    if (!miniInputValue.trim()) return;

    if (playerLetters.length === 0) {
      toast.error("You need to collect some letters first!", { position: "top-center" });
      return;
    }

    const word = miniInputValue.trim().toUpperCase();
    const wordLetters = word.split("");
    const availableLetters = [...playerLetters];

    // Check if word can be formed from collected letters
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
      toast.error("Word must be made only from your collected letters!", { position: "top-center" });
      return;
    }

    try {
      // Analytics for grand attempt
      if (soloSessionIdRef.current) {
        logAnalytics({
          action: "incrementGrand",
          soloSessionId: soloSessionIdRef.current,
          playerId
        }).catch(e => console.error(e));

        if (!hasTrackedFirstGrandRef.current) {
          hasTrackedFirstGrandRef.current = true;
          logAnalytics({
            action: "trackFirstGrand",
            soloSessionId: soloSessionIdRef.current,
            playerId,
            currentLetterCount: playerLetters.length,
            roundsBeforeFirstGrandAttempt: roundNumber
          }).catch(e => console.error(e));
        }
      }

      const result = await validateWordMutation.mutateAsync({
        word,
        category: baseCategory,
        allowedLetters: playerLetters
      });

      if (result.valid && result.fitsCategory !== false) {
        // Analytics: Winner
        if (soloSessionIdRef.current) {
          logAnalytics({
            action: "finalize",
            soloSessionId: soloSessionIdRef.current,
            playerId,
            finalLetterCount: playerLetters.length,
            result: "Win",
            totalRounds: roundNumber,
            finalGrandWord: word,
            possibleGrandWord: undefined
          }).catch(e => console.error(e));
        }

        playTing();
        setGrandWinningWord(word);
        setGameState("game-over");
      } else if (!result.valid) {
        toast.error(result.rejectionReason || "Not a valid word!", { position: "top-center" });
      } else {
        toast.error(result.rejectionReason || `"${word}" doesn't fit the WIN Category "${baseCategory}"!`, { position: "top-center" });
      }
    } catch (err) {
      toast.error("Validation error", { position: "top-center" });
    }
  };

  return {
    miniInputValue,
    setMiniInputValue,
    playerLetters,
    setPlayerLetters,
    grandWinningWord,
    setGrandWinningWord,
    roundWinner,
    setRoundWinner,
    winningWord,
    setWinningWord,
    usedLetter,
    setUsedLetter,
    handleMiniSubmit,
    handleGrandSubmit
  };
}