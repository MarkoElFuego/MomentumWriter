"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_APPEARANCE, getAppearance, saveAppearance } from "@/lib/db/settings";
import { applyTheme, currentTheme, type ThemeName } from "@/lib/themes";

export interface AppearanceControls {
  /** The theme on screen (saved, or what the system picked). */
  theme: ThemeName;
  onTheme: (theme: ThemeName) => void;
  focusMode: boolean;
  onToggleFocus: () => void;
  typewriter: boolean;
  onToggleTypewriter: () => void;
}

function persist(change: Parameters<typeof saveAppearance>[0]) {
  saveAppearance(change).catch((error) => console.error("Failed to save appearance", error));
}

/** Theme, focus mode and typewriter scroll — saved in Dexie, applied instantly. */
export function useAppearance(): AppearanceControls {
  const [theme, setTheme] = useState<ThemeName>("papir");
  const [focusMode, setFocusMode] = useState(DEFAULT_APPEARANCE.focusMode);
  const [typewriter, setTypewriter] = useState(DEFAULT_APPEARANCE.typewriter);

  useEffect(() => {
    let cancelled = false;
    setTheme(currentTheme());
    getAppearance()
      .then((saved) => {
        if (cancelled) return;
        // Dexie wins over the first-paint mirror (e.g. after clearing site data).
        applyTheme(saved.theme ?? null);
        setTheme(currentTheme());
        setFocusMode(saved.focusMode);
        setTypewriter(saved.typewriter);
      })
      .catch((error) => console.error("Failed to load appearance", error));
    return () => {
      cancelled = true;
    };
  }, []);

  const onTheme = useCallback((next: ThemeName) => {
    applyTheme(next);
    setTheme(next);
    persist({ theme: next });
  }, []);

  const onToggleFocus = useCallback(() => {
    setFocusMode((on) => {
      persist({ focusMode: !on });
      return !on;
    });
  }, []);

  const onToggleTypewriter = useCallback(() => {
    setTypewriter((on) => {
      persist({ typewriter: !on });
      return !on;
    });
  }, []);

  return { theme, onTheme, focusMode, onToggleFocus, typewriter, onToggleTypewriter };
}
