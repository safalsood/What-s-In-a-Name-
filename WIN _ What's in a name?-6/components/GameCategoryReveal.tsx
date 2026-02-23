import React, { useEffect, useRef, useState } from "react";
import styles from "./GameCategoryReveal.module.css";

interface GameCategoryRevealProps {
  category: string;
  onComplete: () => void;
}

export function GameCategoryReveal({ category, onComplete }: GameCategoryRevealProps) {
  // Stages:
  // initial: just overlay fading in
  // reveal: Text reveals
  // exit: Fade out everything
  const [stage, setStage] = useState<"initial" | "reveal" | "exit">("initial");

  // Keep ref to onComplete to avoid restarting effect when parent re-renders
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // Sequence timing
    // 0ms: initial (overlay appears)
    // 500ms: reveal (Category text scales up)
    // 3500ms: exit (fade out)
    // 4000ms: complete

    const revealTimer = setTimeout(() => {
      setStage("reveal");
    }, 500);

    const exitTimer = setTimeout(() => {
      setStage("exit");
    }, 3500);

    const completeTimer = setTimeout(() => {
      onCompleteRef.current();
    }, 4000);

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  return (
    <div className={`${styles.overlay} ${styles[stage]}`}>
      <div className={styles.content}>
        <div className={styles.label}>The Grand Category Is</div>
        <div className={styles.categoryName}>
          {category}
        </div>
      </div>
    </div>
  );
}