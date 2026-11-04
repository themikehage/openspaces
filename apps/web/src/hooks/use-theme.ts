import { useCallback, useState } from "react";
import { readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";

type Theme = "light" | "dark";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function read(): Theme {
  const saved = readStorage(STORAGE_KEYS.theme);
  return saved === "light" || saved === "dark" ? saved : systemTheme();
}

function apply(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

apply(read());

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(read);
  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    apply(next);
    writeStorage(STORAGE_KEYS.theme, next);
    setTheme(next);
  }, [theme]);
  return { theme, toggle };
}
