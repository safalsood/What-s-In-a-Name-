import React from "react";
import { Check } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import {
  DEMO_LETTERS,
  DEMO_MINI_CATEGORY,
  DEMO_MINI_ANSWER,
  DEMO_EARNED_LETTER,
  DEMO_GRAND_CATEGORY,
  DEMO_COLLECTED_LETTERS,
  DEMO_GRAND_ANSWER,
} from "../helpers/gameTutorialSteps";
import styles from "./GameTutorialMockGame.module.css";

interface GameTutorialMockGameProps {
  stepState: "welcome" | "letters" | "miniCategory" | "typing" | "letterEarned" | "grandCategory" | "victory";
  className?: string;
}

const ZapIcon = () => <span style={{ color: "var(--accent)" }}>⚡</span>;

export function GameTutorialMockGame({ stepState, className }: GameTutorialMockGameProps) {
  const showLetters = ["letters", "miniCategory", "typing", "letterEarned", "grandCategory", "victory"].includes(stepState);
  const showMiniCategory = ["miniCategory", "typing", "letterEarned", "grandCategory", "victory"].includes(stepState);
  const showInput = ["typing", "letterEarned", "grandCategory", "victory"].includes(stepState);
  const showCollectedLetters = ["letterEarned", "grandCategory", "victory"].includes(stepState);
  const showGrandCategory = ["grandCategory", "victory"].includes(stepState);
  const showGrandInput = ["victory"].includes(stepState);

  const inputValue = stepState === "typing" || stepState === "letterEarned" ? DEMO_MINI_ANSWER : 
                      stepState === "victory" ? DEMO_GRAND_ANSWER : "";

  const collectedLetters = stepState === "letterEarned" ? [DEMO_EARNED_LETTER] : 
                           stepState === "grandCategory" || stepState === "victory" ? DEMO_COLLECTED_LETTERS : [];

  return (
    <div className={`${styles.container} ${className || ""}`}>
      {stepState === "welcome" && (
        <div className={styles.welcomeScreen}>
          <div className={styles.welcomeIcon}>🎭</div>
          <h2 className={styles.welcomeTitle}>What's In a Name ?</h2>
          <p className={styles.welcomeSubtitle}>A category based word game</p>
        </div>
      )}

      {showLetters && (
        <div className={styles.gameView}>
          <div className={styles.topSection}>
            <div className={styles.roundBadge}>Round 1</div>
            <div className={styles.timer}>01:00</div>
          </div>

          {showMiniCategory && (
            <div className={styles.miniCategorySection}>
              <div className={styles.categoryLabel}>✦ Mini Category ✦</div>
              <div className={styles.categoryValue}>{DEMO_MINI_CATEGORY}</div>
            </div>
          )}

          <div className={styles.lettersDisplay}>
            <div className={styles.lettersRow}>
              {DEMO_LETTERS.map((letter, idx) => {
                const isTough = letter === "Z";
                return (
                  <div
                    key={idx}
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

          {showInput && (
            <div className={styles.inputSection}>
              <Input
                value={inputValue}
                readOnly
                className={styles.mockInput}
                placeholder="Type a word..."
              />
              <Button className={styles.submitBtn} disabled={!inputValue}>
                Submit Mini
              </Button>
            </div>
          )}

          {(showCollectedLetters || showGrandCategory) && (
            <div className={styles.bottomSection}>
              <div className={styles.bottomGrid}>
                {showGrandCategory && (
                  <div className={styles.leftColumn}>
                    <div className={styles.grandCategorySection}>
                      <div className={styles.grandCategoryLabel}>Grand Category</div>
                      <div className={styles.grandCategoryValue}>{DEMO_GRAND_CATEGORY}</div>
                    </div>
                    {showGrandInput && (
                      <div className={styles.grandInputWrapper}>
                        <Button className={styles.submitGrandBtn}>
                          Submit Grand
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {showCollectedLetters && (
                  <div className={styles.rightColumn}>
                    <div className={styles.ownedLettersLabel}>Your Letters</div>
                    <div className={styles.ownedLettersTiles}>
                      {collectedLetters.map((l, i) => (
                        <div key={i} className={styles.ownedLetterTile}>
                          {l}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {stepState === "letterEarned" && (
            <div className={styles.successOverlay}>
              <div className={styles.successIcon}>
                <Check size={48} />
              </div>
              <div className={styles.successText}>Letter Earned: {DEMO_EARNED_LETTER}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}