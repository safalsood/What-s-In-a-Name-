import { Coffee } from "lucide-react";
import { Button } from "./Button";
import styles from "./TutorialWaitingScreen.module.css";

interface TutorialWaitingScreenProps {
  onViewTutorial: () => void;
  isHost: boolean;
  onSkipTutorialWait?: () => void;
  playersNeedingTutorial: number;
  totalPlayers: number;
}

export function TutorialWaitingScreen({
  onViewTutorial,
  isHost,
  onSkipTutorialWait,
  playersNeedingTutorial,
  totalPlayers,
}: TutorialWaitingScreenProps) {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <Coffee size={48} strokeWidth={1.5} />
        </div>
        
        <h2 className={styles.title}>
          Other players need a tutorial, noobs.
        </h2>
        
        <p className={styles.subtitle}>
          {isHost 
            ? "You can wait or start anyway."
            : "The host will start the game soon."}
        </p>

        <p className={styles.playerCount}>
          Waiting for {playersNeedingTutorial} of {totalPlayers} players...
        </p>

        <div className={styles.actions}>
          {isHost && onSkipTutorialWait && (
            <Button 
              onClick={onSkipTutorialWait}
              className={styles.skipButton}
            >
              Start Game Anyway
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={onViewTutorial}
            className={styles.tutorialButton}
          >
            View Tutorial
          </Button>
        </div>

        <div className={styles.waitingIndicator}>
          <span className={styles.dot}></span>
          <span className={styles.dot}></span>
          <span className={styles.dot}></span>
        </div>
      </div>
    </div>
  );
}