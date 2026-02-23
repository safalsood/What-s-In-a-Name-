import React from "react";
import { Skeleton } from "./Skeleton";
import { Lock } from "lucide-react";
import styles from "./AuthLoadingState.module.css";

interface AuthLoadingStateProps {
  title?: string;
  className?: string;
}

export const AuthLoadingState: React.FC<AuthLoadingStateProps> = ({
  title = "Authenticating...",
  className,
}) => {
  return (
    <div className={`${styles.container} ${className || ""}`}>
      <div className={styles.content}>
        <div className={styles.skeletonGrid}>
          {/* Top row */}
          <div className={styles.skeletonRow}>
            <Skeleton className={styles.skeletonBar} style={{ width: "90%" }} />
            <Skeleton className={styles.skeletonBar} style={{ width: "75%" }} />
            <Skeleton className={styles.skeletonBar} style={{ width: "85%" }} />
          </div>

          {/* Middle row with title surrounded by skeletons */}
          <div className={styles.titleRow}>
            <div className={styles.leftSkeletons}>
              <Skeleton
                className={styles.skeletonBar}
                style={{ width: "100%" }}
              />
              <Skeleton
                className={styles.skeletonBar}
                style={{ width: "80%" }}
              />
              <Skeleton
                className={styles.skeletonBar}
                style={{ width: "90%" }}
              />
            </div>

            <h3 className={styles.title}>
              <Lock className={styles.lockIcon} />
              <span>{title}</span>
            </h3>

            <div className={styles.rightSkeletons}>
              <Skeleton
                className={styles.skeletonBar}
                style={{ width: "90%" }}
              />
              <Skeleton
                className={styles.skeletonBar}
                style={{ width: "100%" }}
              />
              <Skeleton
                className={styles.skeletonBar}
                style={{ width: "75%" }}
              />
            </div>
          </div>

          {/* Bottom row */}
          <div className={styles.skeletonRow}>
            <Skeleton className={styles.skeletonBar} style={{ width: "80%" }} />
            <Skeleton className={styles.skeletonBar} style={{ width: "95%" }} />
            <Skeleton className={styles.skeletonBar} style={{ width: "70%" }} />
          </div>
        </div>
      </div>
    </div>
  );
};
