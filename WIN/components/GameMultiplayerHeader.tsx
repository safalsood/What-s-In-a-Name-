import React from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import styles from "./GameMultiplayerHeader.module.css";

interface GameMultiplayerHeaderProps {
  roundNumber: number;
  timer: number;
  onExit: () => void;
  onPass: () => void;
  canPass: boolean;
  roomCode?: string;
  roundRef?: React.RefObject<HTMLSpanElement | null>;
  timerRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

export function GameMultiplayerHeader({
  roundNumber,
  timer,
  onExit,
  onPass,
  canPass,
  roomCode,
  roundRef,
  timerRef,
  className,
}: GameMultiplayerHeaderProps) {
  return (
    <header className={`${styles.header} ${className || ""}`}>
      <div className={styles.headerLeft}>
        <Button
          variant="ghost"
          size="icon-sm"
          className={styles.exitButton}
          onClick={onExit}
          aria-label="Exit Game"
        >
          <X size={20} />
        </Button>
        <span ref={roundRef} className={styles.roundBadge}>
          Round {roundNumber}
        </span>
        {roomCode && (
          <span className={styles.roomCode}>
            {roomCode}
          </span>
        )}
      </div>

      <div className={styles.headerRight}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onPass}
          className={styles.passButton}
          disabled={!canPass}
        >
          Pass
        </Button>
        <div
          ref={timerRef}
          className={styles.timer}
          data-urgent={timer <= 10}
        >
          <span>
            {!Number.isFinite(timer) || Number.isNaN(timer)
              ? "00:60"
              : `${String(Math.floor(timer / 60)).padStart(2, "0")}:${String(timer % 60).padStart(2, "0")}`}
          </span>
        </div>
      </div>
    </header>
  );
}