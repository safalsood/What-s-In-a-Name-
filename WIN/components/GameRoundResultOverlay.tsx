import { useEffect, useState } from "react";
import { Trophy, Frown, XCircle } from "lucide-react";
import { Badge } from "./Badge";
import styles from "./GameRoundResultOverlay.module.css";

interface GameRoundResultOverlayProps {
  winner: "player" | "ai" | null;
  winnerName?: string;
  word?: string;
  miniCategory?: string;
  className?: string;
}

export const GameRoundResultOverlay = ({
  winner,
  winnerName,
  word,
  miniCategory,
  className,
}: GameRoundResultOverlayProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Small delay to allow enter animation
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const getResultContent = () => {
    if (winner === "player") {
      return {
        title: "You Won!",
        icon: <Trophy size={48} className={styles.iconWin} />,
        colorClass: styles.win,
      };
    }
    if (winner === "ai") {
      return {
        title: winnerName ? `${winnerName} Won` : "AI Won",
        icon: <Frown size={48} className={styles.iconLoss} />,
        colorClass: styles.loss,
      };
    }
    return {
      title: "Time's Up!",
      icon: <XCircle size={48} className={styles.iconDraw} />,
      colorClass: styles.draw,
    };
  };

  const { title, icon, colorClass } = getResultContent();

  return (
    <div
      className={`${styles.overlay} ${isVisible ? styles.visible : ""} ${className || ""}`}
    >
      <div className={`${styles.card} ${colorClass}`}>
        <div className={styles.iconWrapper}>{icon}</div>
        <h2 className={styles.title}>{title}</h2>
        
        {miniCategory && (
          <div className={styles.categoryInfo}>
            <span className={styles.categoryLabel}>Mini Category</span>
            <span className={styles.categoryName}>{miniCategory}</span>
          </div>
        )}

        {word ? (
          <div className={styles.wordContainer}>
            <span className={styles.wordLabel}>Winning Word</span>
            <div className={styles.word}>{word}</div>
            <div className={styles.letterBonus}>
              <span>Collected:</span>
              <Badge variant="outline" className={styles.letterBadge}>
                {word.charAt(0)}
              </Badge>
            </div>
          </div>
        ) : (
          <div className={styles.message}>
            No winner this round.
          </div>
        )}
        
        <div className={styles.loader}>
          <div className={styles.loaderBar} />
        </div>
      </div>
    </div>
  );
};