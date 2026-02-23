import React, { useState, useEffect } from "react";
import { Button } from "./Button";
import { X, ChevronRight, Check } from "lucide-react";
import { GameTutorialMockGame } from "./GameTutorialMockGame";
import { TUTORIAL_STEPS } from "../helpers/gameTutorialSteps";
import styles from "./GameTutorial.module.css";

interface GameTutorialProps {
  onComplete: () => void;
  className?: string;
}

export function GameTutorial({ onComplete, className }: GameTutorialProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const currentStep = TUTORIAL_STEPS[currentStepIndex];

  useEffect(() => {
    // Fade in animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleNext = () => {
    if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className={`${styles.container} ${isVisible ? styles.visible : ""} ${className || ""}`}>
      {/* Mock Game Display */}
      <div className={styles.mockGameContainer}>
        <GameTutorialMockGame stepState={currentStep.mockGameState} />
      </div>

      {/* Tutorial Overlay Card */}
      <div className={styles.tutorialCard}>
        <div className={styles.header}>
          <span className={styles.stepIndicator}>
            Step {currentStepIndex + 1}/{TUTORIAL_STEPS.length}
          </span>
          <button onClick={handleSkip} className={styles.skipButton}>
            <X size={16} /> Skip
          </button>
        </div>

        <h3 className={styles.title}>{currentStep.title}</h3>
        <p className={styles.text}>{currentStep.text}</p>

        <div className={styles.footer}>
          <div className={styles.dots}>
            {TUTORIAL_STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`${styles.dot} ${idx === currentStepIndex ? styles.activeDot : ""}`}
              />
            ))}
          </div>

          <Button onClick={handleNext} size="sm" className={styles.nextButton}>
            {currentStepIndex === TUTORIAL_STEPS.length - 1 ? (
              <>
                Start Game <Check size={16} />
              </>
            ) : (
              <>
                Next <ChevronRight size={16} />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}