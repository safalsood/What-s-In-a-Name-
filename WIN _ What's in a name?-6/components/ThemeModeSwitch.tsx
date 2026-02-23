"use client";

import React from "react";
import { Sun, Moon, SunMoon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./DropdownMenu";
import { Button } from "./Button";
import { useThemeMode, ThemeMode } from "../helpers/themeMode";
import styles from "./ThemeModeSwitch.module.css";

export interface ThemeModeSwitchProps {
  /**
   * Optional CSS class to apply to the component
   */
  className?: string;
}

// Note: if the current style only supports one mode (light or dark), we will need to
// first update the global style to support 2 modes before using this component.
export const ThemeModeSwitch = ({ className }: ThemeModeSwitchProps) => {
  const { mode, switchToLightMode, switchToDarkMode, switchToAutoMode } =
    useThemeMode();

  const applyThemeMode = (newMode: ThemeMode) => {
    switch (newMode) {
      case "light":
        switchToLightMode();
        break;
      case "dark":
        switchToDarkMode();
        break;
      case "auto":
        switchToAutoMode();
        break;
    }
  };

  const getThemeIcon = () => {
    switch (mode) {
      case "light":
        return <Sun className={styles.icon} />;
      case "dark":
        return <Moon className={styles.icon} />;
      case "auto":
        return <SunMoon className={styles.icon} />;
      default:
        return <Sun className={styles.icon} />;
    }
  };

  return (
    <div className={`${styles.container} ${className || ""}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            aria-label={`Current theme: ${mode}. Click to change theme`}
            className={styles.themeButton}
          >
            {getThemeIcon()}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className={mode === "light" ? styles.activeItem : ""}
            onClick={() => applyThemeMode("light")}
          >
            <Sun size={16} className={styles.menuIcon} />
            Light
            {mode === "light" && <span className={styles.checkmark}>✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={mode === "dark" ? styles.activeItem : ""}
            onClick={() => applyThemeMode("dark")}
          >
            <Moon size={16} className={styles.menuIcon} />
            Dark
            {mode === "dark" && <span className={styles.checkmark}>✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={mode === "auto" ? styles.activeItem : ""}
            onClick={() => applyThemeMode("auto")}
          >
            <SunMoon size={16} className={styles.menuIcon} />
            Auto
            {mode === "auto" && <span className={styles.checkmark}>✓</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
