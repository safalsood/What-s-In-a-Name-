import React, { useEffect, useState } from "react";
import { Trophy, RefreshCw, Home, Eye } from "lucide-react";
import { Button } from "./Button";
import { Link } from "react-router-dom";
import { useMissedWords } from "../helpers/useMissedWords";
import { Skeleton } from "./Skeleton";
import { postMissedWords, InputType as SoloInputType } from "../endpoints/solo/missed-words_POST.schema";
import { useQuery } from "@tanstack/react-query";
import styles from "./GameWinnerScreen.module.css";

interface GameWinnerScreenProps {
  winningWord: string;
  baseCategory: string;
  roundsPlayed: number;
  onPlayAgain: () => void;
  className?: string;
  isWinner?: boolean;
  winnerName?: string;
  roomCode?: string;
  playerId?: string;
  soloMissedWordsData?: SoloInputType;
}

const VICTORY_MESSAGE = "LOOK WHO DIDN'T LOSE.";
const DEFEAT_MESSAGE = "I SHOULD'VE HELPED YOU CHEAT.";

// Simple Firework Particle Component
const Firework = ({ delay, x, color }: { delay: number; x: number; color: string }) => {
  return (
    <div 
      className={styles.firework} 
      style={{ 
        left: `${x}%`, 
        animationDelay: `${delay}s`,
        "--color": color 
      } as React.CSSProperties}
    >
      {/* Explosion particles */}
      {[...Array(12)].map((_, i) => (
        <div 
          key={i} 
          className={styles.particle} 
          style={{ 
            transform: `rotate(${i * 30}deg) translateY(-60px)`,
            "--angle": `${i * 30}deg`
          } as React.CSSProperties} 
        />
      ))}
    </div>
  );
};

export const GameWinnerScreen = ({
  winningWord,
  baseCategory,
  roundsPlayed,
  onPlayAgain,
  className,
  isWinner = true,
  winnerName,
  roomCode,
  playerId,
  soloMissedWordsData,
}: GameWinnerScreenProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showMissedWords, setShowMissedWords] = useState(false);

  // Multiplayer Hook
  const { data: multiMissedWordsData, isFetching: isFetchingMulti } = useMissedWords(
    { roomCode: roomCode || "", playerId: playerId || "" },
    showMissedWords && !!roomCode && !!playerId
  );

  // Solo Hook
  const { data: soloMissedWordsResult, isFetching: isFetchingSolo } = useQuery({
    queryKey: ["soloMissedWords", soloMissedWordsData],
    queryFn: () => {
      if (!soloMissedWordsData) throw new Error("No data");
      return postMissedWords(soloMissedWordsData);
    },
    enabled: showMissedWords && !!soloMissedWordsData && !roomCode,
    staleTime: Infinity,
  });

  // Unified Data
  const missedWordsData = roomCode ? multiMissedWordsData : soloMissedWordsResult;
  const isFetchingMissedWords = roomCode ? isFetchingMulti : isFetchingSolo;

  useEffect(() => {
    // Fade in
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`${styles.container} ${isVisible ? styles.visible : ""} ${className || ""}`}>
      {/* Fireworks Background - Only for winners */}
      {isWinner && (
        <div className={styles.fireworksContainer}>
          <Firework delay={0.2} x={20} color="#d4af37" />
          <Firework delay={0.5} x={50} color="#ffd700" />
          <Firework delay={0.8} x={80} color="#cf6679" />
          <Firework delay={1.2} x={30} color="#f5f0e1" />
          <Firework delay={1.5} x={70} color="#d4af37" />
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.trophyWrapper}>
          <div className={`${styles.glow} ${!isWinner ? styles.glowDefeat : ''}`} />
          <Trophy size={80} className={`${styles.trophy} ${!isWinner ? styles.trophyDefeat : ''}`} />
        </div>

        <h1 className={`${styles.title} ${!isWinner ? styles.titleDefeat : ''}`}>
          {isWinner ? "Victory!" : "Defeat!"}
        </h1>
        
        <div className={styles.scroll}>
          <p className={`${styles.message} ${!isWinner ? styles.messageDefeat : ''}`}>
            {isWinner ? VICTORY_MESSAGE : DEFEAT_MESSAGE}
          </p>
        </div>

        <div className={styles.statsCard}>
          {!isWinner && winnerName && (
            <>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Winner</span>
                <span className={styles.statValueHighlight}>{winnerName}</span>
              </div>
              <div className={styles.divider} />
            </>
          )}
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Winning Word</span>
            <span className={styles.statValueHighlight}>{winningWord}</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Grand Category</span>
            <span className={styles.statValue}>{baseCategory}</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Rounds Played</span>
            <span className={styles.statValue}>{roundsPlayed}</span>
          </div>
        </div>

        {(roomCode || soloMissedWordsData) && !showMissedWords && (
          <div className={styles.revealSection}>
            <Button 
              variant="secondary" 
              size="lg" 
              onClick={() => setShowMissedWords(true)}
              className={styles.revealBtn}
            >
              <Eye size={20} /> Show What You Missed
            </Button>
          </div>
        )}

        {showMissedWords && (roomCode || soloMissedWordsData) && (
          <div className={styles.missedWordsSection}>
            <h2 className={styles.missedWordsTitle}>Words You Could Have Used</h2>
            
            {/* Grand Category Suggestion */}
            <div className={`${styles.missedWordsCard} ${styles.grandSuggestionCard}`}>
              <h3 className={styles.grandSuggestionTitle}>Grand Category Solution</h3>
              <p className={styles.grandSuggestionSubtitle}>Using your collected letters</p>
              
              {isFetchingMissedWords ? (
                 <div className={styles.missedWordRowCenter}>
                   <Skeleton style={{ width: "60%", height: "2rem" }} />
                 </div>
              ) : (
                <div className={styles.missedWordRowCenter}>
                  {missedWordsData?.grandCategorySuggestion?.word && 
                   missedWordsData.grandCategorySuggestion.word !== "No word" ? (
                    <span className={styles.grandWord}>
                      {missedWordsData.grandCategorySuggestion.word}
                    </span>
                  ) : (
                    <span className={styles.noGrandWord}>No valid word found</span>
                  )}
                </div>
              )}
            </div>

            <div className={styles.missedWordsSpacer} />

            <div className={styles.missedWordsCard}>
              {isFetchingMissedWords ? (
                <>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className={styles.missedWordRow}>
                      <Skeleton style={{ width: "40%", height: "1.2rem" }} />
                      <Skeleton style={{ width: "30%", height: "1.2rem" }} />
                    </div>
                  ))}
                </>
              ) : missedWordsData?.missedWords && missedWordsData.missedWords.length > 0 ? (
                <>
                  {missedWordsData.missedWords.map((item, index) => (
                    <React.Fragment key={index}>
                      <div className={styles.missedWordRow}>
                        <span className={styles.missedCategory}>{item.category}</span>
                        <span className={styles.missedWord}>
                          <span className={styles.missedWordLetter}>{item.startingLetter}</span>
                          {item.exampleWord.slice(1)}
                        </span>
                      </div>
                      {index < missedWordsData.missedWords.length - 1 && (
                        <div className={styles.divider} />
                      )}
                    </React.Fragment>
                  ))}
                </>
              ) : (
                <p className={styles.noSuggestions}>No suggestions available</p>
              )}
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <Button onClick={onPlayAgain} size="lg" className={styles.playAgainBtn}>
            <RefreshCw size={20} /> Play Again
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link to="/">
              <Home size={20} /> Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};