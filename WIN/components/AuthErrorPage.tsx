import React from "react";
import { AlertTriangle } from "lucide-react";
import styles from "./AuthErrorPage.module.css";

export interface AuthErrorPageProps {
  /**
   * The title of the error message
   */
  title?: string;
  /**
   * The detailed error message
   */
  message: string;
  /**
   * Optional custom icon
   */
  icon?: React.ReactNode;
  /**
   * Optional additional class name
   */
  className?: string;
}

export const AuthErrorPage: React.FC<AuthErrorPageProps> = ({
  title = "Authentication Error",
  message,
  icon,
  className,
}) => {
  return (
    <div className={`${styles.container} ${className || ""}`}>
      <div className={styles.card}>
        <div className={styles.iconContainer}>
          {icon || <AlertTriangle className={styles.icon} size={64} />}
        </div>

        <h1 className={styles.title}>{title}</h1>

        <p className={styles.message}>{message}</p>
      </div>
    </div>
  );
};
