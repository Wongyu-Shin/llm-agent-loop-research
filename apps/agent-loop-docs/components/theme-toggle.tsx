"use client";

import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  if (typeof document === "undefined") {
    return "light";
  }

  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  function toggleTheme() {
    const nextTheme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("agent-loop-theme", nextTheme);
  }

  return (
    <button className="icon-button" type="button" onClick={toggleTheme} aria-label="색상 테마 전환" title="색상 테마 전환">
      <Moon className="theme-icon theme-icon-light" aria-hidden="true" size={18} />
      <Sun className="theme-icon theme-icon-dark" aria-hidden="true" size={18} />
    </button>
  );
}
