import React from "react";
import { TOUGH_LETTERS } from "../helpers/gameLogic";
import styles from "./GameLettersDisplay.module.css";

interface GameLettersDisplayProps {
  letters: string[];
  roundNumber: number;
  className?: string;
  layout?: "pyramid" | "row";
}

const ZapIcon = () => <span style={{ color: "var(--accent)" }}>⚡</span>;

export const GameLettersDisplay = React.forwardRef<HTMLDivElement, GameLettersDisplayProps>(
  ({ letters, roundNumber, className, layout = "pyramid" }, ref) => {
    if (layout === "row") {
      return (
        <div ref={ref} className={`${styles.container} ${className || ""}`}>
          <div className={styles.singleRow}>
            {letters.map((letter, idx) => {
              const isTough = TOUGH_LETTERS.includes(letter);
              return (
                <div
                  key={`${roundNumber}-${idx}`}
                  className={`${styles.letterTile} ${isTough ? styles.toughTile : ""} ${styles.rowTile}`}
                >
                  {letter}
                  {isTough && (
                    <div className={styles.toughIndicator}>
                      <ZapIcon />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Split letters into pyramid: 3 top, 2 bottom
    const topRow = letters.slice(0, 3);
    const bottomRow = letters.slice(3, 5);

    return (
      <div ref={ref} className={`${styles.container} ${className || ""}`}>
        <div className={styles.pyramid}>
          <div className={styles.topRow}>
            {topRow.map((letter, idx) => {
              const isTough = TOUGH_LETTERS.includes(letter);
              return (
                <div
                  key={`${roundNumber}-${idx}`}
                  className={`${styles.letterTile} ${isTough ? styles.toughTile : ""}`}
                >
                  {letter}
                  {isTough && (
                    <div className={styles.toughIndicator}>
                      <ZapIcon />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className={styles.bottomRow}>
            {bottomRow.map((letter, idx) => {
              const isTough = TOUGH_LETTERS.includes(letter);
              return (
                <div
                  key={`${roundNumber}-${idx + 3}`}
                  className={`${styles.letterTile} ${isTough ? styles.toughTile : ""}`}
                >
                  {letter}
                  {isTough && (
                    <div className={styles.toughIndicator}>
                      <ZapIcon />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);

GameLettersDisplay.displayName = "GameLettersDisplay";