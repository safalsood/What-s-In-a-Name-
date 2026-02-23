import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { Switch } from "../components/Switch";
import { Skeleton } from "../components/Skeleton";
import { ArrowLeft, GraduationCap, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { usePlayerStats } from "../helpers/usePlayerStats";
import { getPlayerId } from "../helpers/playerInfo";
import { SettingsAccountCard } from "../components/SettingsAccountCard";
import styles from "./settings.module.css";

export default function SettingsPage() {
  const [showTutorial, setShowTutorial] = useState(false);
  const playerId = getPlayerId();
  const { data: stats, isFetching: isLoadingStats } = usePlayerStats(playerId);

  useEffect(() => {
    // Load tutorial settings
    const tutorialCompleted = localStorage.getItem(
      "word-challenge-tutorial-completed",
    );
    // If key is present and "true", tutorial is completed (hidden).
    // Otherwise it is shown.
    setShowTutorial(tutorialCompleted !== "true");
  }, []);

  const handleTutorialToggle = (checked: boolean) => {
    setShowTutorial(checked);
    if (checked) {
      // User wants to show tutorial -> remove completion marker
      localStorage.removeItem("word-challenge-tutorial-completed");
      toast.success("Tutorial enabled for next game");
    } else {
      // User wants to skip tutorial -> set completion marker
      localStorage.setItem("word-challenge-tutorial-completed", "true");
      toast.info("Tutorial disabled");
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button variant="ghost" asChild>
          <Link to="/">
            <ArrowLeft size={20} />
            <span style={{ fontFamily: "var(--font-family-heading)" }}>
              Return
            </span>
          </Link>
        </Button>
        <h1 className={styles.title}>Configuration</h1>
        <div style={{ width: "80px" }} /> {/* Spacer for centering */}
      </div>

      <main className={styles.main}>
        {/* Account Card */}
        <SettingsAccountCard />

        {/* Tutorial Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>
              <GraduationCap
                size={24}
                style={{
                  display: "inline-block",
                  verticalAlign: "middle",
                  marginRight: "0.75rem",
                  color: "var(--primary)",
                }}
              />
              Tutorial
            </h2>
          </div>

          <p className={styles.description}>
            Control whether to show the tutorial for new games.
          </p>

          <div className={styles.switchRow}>
            <label htmlFor="tutorial-switch" className={styles.label}>
              <span className={styles.labelText}>Show Tutorial</span>
              <span className={styles.labelDesc}>
                Enabling this will show the tutorial again before your next
                game.
              </span>
            </label>
            <Switch
              id="tutorial-switch"
              checked={showTutorial}
              onCheckedChange={handleTutorialToggle}
            />
          </div>
        </div>

        {/* Statistics Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>
              <TrendingUp
                size={24}
                style={{
                  display: "inline-block",
                  verticalAlign: "middle",
                  marginRight: "0.75rem",
                  color: "var(--primary)",
                }}
              />
              Multiplayer Statistics
            </h2>
          </div>

          <p className={styles.description}>
            Your performance across all multiplayer matches.
          </p>

          {isLoadingStats ? (
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <Skeleton style={{ width: "100%", height: "1.5rem" }} />
                <Skeleton style={{ width: "60%", height: "2rem", marginTop: "0.5rem" }} />
              </div>
              <div className={styles.statItem}>
                <Skeleton style={{ width: "100%", height: "1.5rem" }} />
                <Skeleton style={{ width: "60%", height: "2rem", marginTop: "0.5rem" }} />
              </div>
              <div className={styles.statItem}>
                <Skeleton style={{ width: "100%", height: "1.5rem" }} />
                <Skeleton style={{ width: "60%", height: "2rem", marginTop: "0.5rem" }} />
              </div>
              <div className={styles.statItem}>
                <Skeleton style={{ width: "100%", height: "1.5rem" }} />
                <Skeleton style={{ width: "60%", height: "2rem", marginTop: "0.5rem" }} />
              </div>
              <div className={styles.statItem}>
                <Skeleton style={{ width: "100%", height: "1.5rem" }} />
                <Skeleton style={{ width: "60%", height: "2rem", marginTop: "0.5rem" }} />
              </div>
            </div>
          ) : stats ? (
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Games Played</span>
                <span className={styles.statValue}>{stats.gamesPlayed}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Games Won</span>
                <span className={styles.statValue}>{stats.gamesWon}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Words Submitted</span>
                <span className={styles.statValue}>{stats.wordsSubmitted}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Words Accepted</span>
                <span className={styles.statValue}>{stats.wordsAccepted}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Win Rate</span>
                <span className={styles.statValue}>
                  {stats.gamesPlayed > 0
                    ? `${Math.round((stats.gamesWon / stats.gamesPlayed) * 100)}%`
                    : "0%"}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}