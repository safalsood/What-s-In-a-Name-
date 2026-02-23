import { useEffect, useState } from "react";
import {
  playSwoosh,
  playTheatreGong,
} from "../helpers/gameSounds";
import styles from "./SplashScreen.module.css";

interface SplashScreenProps {
  onComplete: () => void;
  className?: string;
}

export function SplashScreen({ onComplete, className }: SplashScreenProps) {
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    // Total animation: 6 seconds for cleaner theatrical pacing
    const TOTAL_DURATION = 6000;

    // Phase 1: Curtain opens with dramatic swoosh
    setTimeout(() => {
      playTheatreGong();
    }, 200);

    // Phase 2: Title appears
    setTimeout(() => {
      playSwoosh();
    }, 3000);

    const timer = setTimeout(() => {
      setIsMounted(false);
      onComplete();
    }, TOTAL_DURATION);

    return () => {
      clearTimeout(timer);
    };
  }, [onComplete]);

  if (!isMounted) return null;

  return (
    <div className={`${styles.container} ${className || ""}`}>
      {/* Dark Stage Background */}
      <div className={styles.stageBackground}>
        {/* Spotlight */}
        <div className={styles.spotlight}></div>
      </div>

      {/* Red Velvet Curtains */}
      <div className={styles.curtainLeft}>
        <div className={styles.curtainFabric}>
          <div className={styles.curtainFold}></div>
          <div className={styles.curtainFold}></div>
          <div className={styles.curtainFold}></div>
          <div className={styles.curtainFold}></div>
          <div className={styles.curtainFold}></div>
        </div>
        <div className={styles.curtainTrim}></div>
        <div className={styles.curtainHem}></div>
      </div>
      
      <div className={styles.curtainRight}>
        <div className={styles.curtainFabric}>
          <div className={styles.curtainFold}></div>
          <div className={styles.curtainFold}></div>
          <div className={styles.curtainFold}></div>
          <div className={styles.curtainFold}></div>
          <div className={styles.curtainFold}></div>
        </div>
        <div className={styles.curtainTrim}></div>
        <div className={styles.curtainHem}></div>
      </div>

      {/* Stage Content */}
      <div className={styles.stageContent}>
        {/* Shakespeare Watermark */}
        <div className={styles.watermarkContainer}>
          <img
            src="https://assets.floot.app/8790acc4-fa78-4d24-90e7-5829c9bbd59c/96981e08-b763-49b0-b806-6b69b92d5ced.png"
            alt=""
            className={styles.watermark}
          />
        </div>

        {/* Title Group */}
        <div className={styles.titleGroup}>
          <h1 className={styles.mainTitle}>
            <span className={styles.letterW}>W</span>
            <span className={styles.letterI}>I</span>
            <span className={styles.letterN}>N</span>
          </h1>
          <p className={styles.subtitle}>What's In a Name?</p>
        </div>
      </div>
    </div>
  );
}