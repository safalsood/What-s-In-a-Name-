import React, { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Users, Timer, Sparkles, Trophy, Settings, Feather, ScrollText, Globe, RotateCcw, LogIn, User } from "lucide-react";

import { useAuth } from "../helpers/useAuth";
import { PrivateRoomDialog } from "../components/PrivateRoomDialog";
import { PublicMatchmakingDialog } from "../components/PublicMatchmakingDialog";
import { SplashScreen } from "../components/SplashScreen";
import styles from "./_index.module.css";

export default function LandingPage() {
  const { authState } = useAuth();
  const [privateRoomDialogOpen, setPrivateRoomDialogOpen] = useState(false);
  const [publicMatchmakingDialogOpen, setPublicMatchmakingDialogOpen] = useState(false);

  const [showSplash, setShowSplash] = useState(() => {
    try {
      return !sessionStorage.getItem("splashShown");
    } catch {
      return true;
    }
  });

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    try {
      sessionStorage.setItem("splashShown", "true");
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleReplayIntro = () => {
    setShowSplash(true);
  };

  return (
    <div className={styles.container}>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}

      {!showSplash && (
        <Button
          variant="outline"
          size="sm"
          className={styles.replayIntroButton}
          onClick={handleReplayIntro}
        >
          <RotateCcw size={14} />
          Replay Intro
        </Button>
      )}

      <nav className={styles.nav}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <Feather size={24} fill="currentColor" />
          </div>
          <span className={styles.logoText}>
            <span className={styles.logoW}>W</span>
            <span className={styles.logoI}>I</span>
            <span className={styles.logoN}>N</span>
          </span>
        </div>
        <div className={styles.navActions}>
          {authState.type === "authenticated" ? (
            <div className={styles.userProfile}>
              <span className={styles.username}>{authState.user.username}</span>
              <Button variant="ghost" size="icon-md" asChild>
                <Link to="/profile" aria-label="Profile">
                  <User size={24} />
                </Link>
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">
                <LogIn size={18} />
                Sign In
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="icon-md" asChild>
            <Link to="/settings" aria-label="Settings">
              <Settings size={24} />
            </Link>
          </Button>
        </div>
      </nav>

      <main className={styles.main}>
        {/* Hero Section */}
        <div className={styles.hero}>
          
          
          <h1 className={styles.title}>
            <span className={styles.titleW}>W</span>hat&apos;s{' '}
            <span className={styles.titleI}>I</span>n a{' '}
            <span className={styles.titleN}>N</span>ame?
          </h1>
          <p className={styles.subtitle}>Race to earn letters and be the first to crack the Grand Category.</p>

          <div className={styles.actions}>
            <Button size="lg" className={styles.playButton} asChild>
              <Link to="/game">
                <ScrollText size={20} />
                Begin Solo Play
              </Link>
            </Button>
            <Button 
              size="lg" 
              variant="secondary" 
              className={styles.friendsButton}
              onClick={() => setPrivateRoomDialogOpen(true)}
            >
              <Users size={20} />
              Gather Friends
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className={styles.onlineButton}
              onClick={() => setPublicMatchmakingDialogOpen(true)}
            >
              <Globe size={20} />
              Play Online
            </Button>
          </div>

          <PrivateRoomDialog 
            open={privateRoomDialogOpen} 
            onOpenChange={setPrivateRoomDialogOpen} 
          />
          <PublicMatchmakingDialog 
            open={publicMatchmakingDialogOpen} 
            onOpenChange={setPublicMatchmakingDialogOpen} 
          />
        </div>

        <div className={styles.divider}>
          <svg width="100%" height="24" viewBox="0 0 100 24" preserveAspectRatio="none">
            <path d="M0,12 Q50,24 100,12" stroke="var(--primary)" fill="none" strokeWidth="2" opacity="0.5" />
            <path d="M0,12 Q50,0 100,12" stroke="var(--primary)" fill="none" strokeWidth="2" opacity="0.5" />
          </svg>
        </div>

        {/* Combined Game Overview */}
        <div className={styles.howToPlaySection}>
          <h2 className={styles.sectionTitle}>The Play</h2>
          <div className={styles.stepsGrid}>
            <div className={styles.stepCard}>
              <div className={styles.stepIcon}><Timer size={32} /></div>
              <h3>Swift as a Shadow</h3>
              <p>Be the fastest to win letters in Mini Category. Submit a word that starts with any one of the letters.</p>
            </div>
            
            <div className={styles.stepCard}>
              <div className={styles.stepIcon}><Sparkles size={32} /></div>
              <h3>Gather Your Wits</h3>
              <p>Each correct win earns you a letter. Rare letters unlock Bonus Mode for extra chances.Keep collecting — every letter counts.</p>
            </div>

            <div className={styles.stepCard}>
              <div className={styles.stepIcon}><Trophy size={32} /></div>
              <h3>The Final Masterpiece</h3>
              <p>Use your collected letters to make a word that fits the Grand Category.First correct Grand Category word wins the game.</p>
            </div>
          </div>
        </div>

      </main>
      
      <div className={styles.footerDecoration} />
      <footer className={styles.footer}>
        <p>All the world's a stage, and all the men and women merely players. Welcome Sukoon, our newest player.</p>
        <p className={styles.copyright}>Creator: Asafal</p>
      </footer>
    </div>
  );
}