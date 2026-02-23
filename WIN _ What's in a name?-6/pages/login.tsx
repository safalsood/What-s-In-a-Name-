import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Feather } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/Tabs";
import { PasswordLoginForm } from "../components/PasswordLoginForm";
import { PasswordRegisterForm } from "../components/PasswordRegisterForm";
import { Button } from "../components/Button";
import { useAuth } from "../helpers/useAuth";
import { Spinner } from "../components/Spinner";
import { toast } from "sonner";
import styles from "./login.module.css";

export default function LoginPage() {
  const { authState } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sessionExpired") === "true") {
      // Use setTimeout to ensure toast appears after any potential render flashes
      setTimeout(() => {
        toast.info("Session expired", {
          description: "Please log in again to continue.",
          duration: 5000,
        });
      }, 100);

      // Clean up URL without reloading to prevent showing the toast again on refresh
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (authState.type === "authenticated") {
      navigate("/");
    }
  }, [authState, navigate]);

  if (authState.type === "loading") {
    return (
      <div className={styles.loadingContainer}>
        <Spinner size="lg" />
      </div>
    );
  }

  // If authenticated, we are redirecting, so render nothing or a spinner
  if (authState.type === "authenticated") {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.backgroundOverlay} />
      
      <div className={styles.content}>
        <div className={styles.header}>
          <Link to="/" className={styles.logoLink}>
            <div className={styles.logoIcon}>
              <Feather size={32} fill="currentColor" />
            </div>
            <h1 className={styles.title}>
              <span className={styles.titleW}>W</span>
              <span className={styles.titleI}>I</span>
              <span className={styles.titleN}>N</span>
            </h1>
          </Link>
          <p className={styles.subtitle}>Enter the Stage</p>
        </div>

        <div className={styles.card}>
          <Tabs defaultValue="signin" className={styles.tabs}>
            <TabsList className={styles.tabsList}>
              <TabsTrigger value="signin" className={styles.tabTrigger}>Sign In</TabsTrigger>
              <TabsTrigger value="signup" className={styles.tabTrigger}>Sign Up</TabsTrigger>
            </TabsList>
            
            <div className={styles.formContainer}>
              <TabsContent value="signin" className={styles.tabContent}>
                <div className={styles.tabHeader}>
                  <h2>Welcome Back</h2>
                  <p>Resume your journey of words.</p>
                </div>
                <PasswordLoginForm />
              </TabsContent>
              
              <TabsContent value="signup" className={styles.tabContent}>
                <div className={styles.tabHeader}>
                  <h2>New Player?</h2>
                  <p>Join the tavern and prove your wit.</p>
                </div>
                <PasswordRegisterForm />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className={styles.footer}>
          <Button variant="link" asChild className={styles.backLink}>
            <Link to="/">
              <ArrowLeft size={16} />
              Return to Tavern
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}