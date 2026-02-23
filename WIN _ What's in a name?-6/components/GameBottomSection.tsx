import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import styles from "./GameBottomSection.module.css";

const ZapIcon = () => <span style={{ color: "var(--accent)" }}>⚡</span>;

interface Player {
  id: number;
  playerId: string;
  playerName: string;
  collectedLetters?: string[] | null;
}

interface GameBottomSectionProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onMiniSubmit: (e: React.FormEvent) => void;
  onGrandSubmit: () => void;
  baseCategory: string;
  currentPlayerLetters: string[];
  otherPlayers?: Player[];
  bonusActive?: boolean;
  isSubmitting?: boolean;
  isGameFinished?: boolean;
  onInputFocus?: () => void;
  onInputBlur?: () => void;
  onInputTouchStart?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  miniCategoryRef?: React.RefObject<HTMLDivElement | null>;
  inputSectionRef?: React.RefObject<HTMLFormElement | null>;
  submitMiniRef?: React.RefObject<HTMLButtonElement | null>;
  baseCategoryRef?: React.RefObject<HTMLDivElement | null>;
  ownedLettersRef?: React.RefObject<HTMLDivElement | null>;
  submitGrandRef?: React.RefObject<HTMLButtonElement | null>;
  className?: string;
  placeholder?: string;
  isKeyboardMode?: boolean;
}

export function GameBottomSection({
  inputValue,
  onInputChange,
  onMiniSubmit,
  onGrandSubmit,
  baseCategory,
  currentPlayerLetters,
  otherPlayers = [],
  bonusActive = false,
  isSubmitting = false,
  isGameFinished = false,
  onInputFocus,
  onInputBlur,
  onInputTouchStart,
  inputRef,
  inputSectionRef,
  submitMiniRef,
  baseCategoryRef,
  ownedLettersRef,
  submitGrandRef,
  className,
  placeholder,
  isKeyboardMode = false,
}: GameBottomSectionProps) {
  const [showOtherPlayers, setShowOtherPlayers] = useState(false);

  // Auto-collapse other players when keyboard is open to save space
  useEffect(() => {
    if (isKeyboardMode) {
      setShowOtherPlayers(false);
    }
  }, [isKeyboardMode]);

  return (
    <div
      className={`${styles.bottomSection} ${isKeyboardMode ? styles.keyboardMode : ""} ${className || ""}`}
    >
      <form
        ref={inputSectionRef}
        onSubmit={onMiniSubmit}
        className={styles.inputRow}
      >
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={
            placeholder || (bonusActive ? "Bonus word..." : "Type a word...")
          }
          className={styles.gameInput}
          disabled={isGameFinished}
          autoComplete="off"
          onFocus={() => onInputFocus?.()}
          onBlur={() => onInputBlur?.()}
          onTouchStart={() => onInputTouchStart?.()}
        />
        <Button
          ref={submitMiniRef}
          type="submit"
          disabled={!inputValue || isGameFinished || isSubmitting}
          className={styles.submitMiniBtn}
          onPointerDown={(e) => {
            // Prevent input blur to allow immediate submission on touch devices
            e.preventDefault();
          }}
        >
          Submit Mini
        </Button>
      </form>

      {bonusActive && (
        <div className={styles.bonusAlert}>
          <ZapIcon /> Bonus Active!
        </div>
      )}

      <div className={styles.bottomGrid}>
        <div className={styles.leftColumn}>
          <div ref={baseCategoryRef} className={styles.grandCategorySection}>
            <div className={styles.grandCategoryLabel}>Grand Category</div>
            <div className={styles.grandCategoryValue}>{baseCategory}</div>
          </div>

          <div className={styles.grandInputWrapper}>
            <Button
              ref={submitGrandRef}
              onClick={onGrandSubmit}
              disabled={
                !inputValue ||
                isGameFinished ||
                currentPlayerLetters.length === 0
              }
              className={styles.submitGrandBtn}
            >
              Submit Grand
            </Button>
          </div>
        </div>

        <div className={styles.columnDivider} />

        <div ref={ownedLettersRef} className={styles.rightColumn}>
          <div className={styles.ownedLettersLabel}>Your Letters</div>
          <div className={styles.ownedLettersTiles}>
            {currentPlayerLetters.length > 0 ? (
              currentPlayerLetters.map((l, i) => (
                <div
                  key={i}
                  className={styles.ownedLetterTile}
                  style={{
                    color: ["A", "E", "I", "O", "U"].includes(l.toUpperCase())
                      ? "#ef4444"
                      : "#4ade80",
                  }}
                >
                  {l}
                </div>
              ))
            ) : (
              <span className={styles.emptyLetters}>None yet</span>
            )}
          </div>
        </div>
      </div>

      {otherPlayers && otherPlayers.length > 0 && (
        <div className={styles.otherPlayersSection}>
          <button
            type="button"
            onClick={() => setShowOtherPlayers(!showOtherPlayers)}
            className={styles.otherPlayersToggle}
          >
            <span>Other Players ({otherPlayers.length})</span>
            {showOtherPlayers ? (
              <ChevronUp size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
          </button>

          {showOtherPlayers && (
            <div className={styles.otherPlayersList}>
              {otherPlayers.map((player) => (
                <div key={player.id} className={styles.otherPlayerItem}>
                  <div className={styles.otherPlayerInfo}>
                    <span className={styles.otherPlayerIcon}>🎭</span>
                    <span className={styles.otherPlayerName}>
                      {player.playerName}
                    </span>
                    <span className={styles.otherLetterCount}>
                      {player.collectedLetters?.length || 0}
                    </span>
                  </div>
                  <div className={styles.otherPlayerTiles}>
                    {player.collectedLetters?.map((l, i) => (
                      <div key={i} className={styles.otherPlayerTile}>
                        {l}
                      </div>
                    ))}
                    {(!player.collectedLetters ||
                      player.collectedLetters.length === 0) && (
                      <span className={styles.emptyLetters}>—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
