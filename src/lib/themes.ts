// Visual themes (v0.2 Faza 7). Colors live in src/styles/themes.css; only the
// paper color is repeated here for the swatches in the ··· menu (themes.test.ts
// keeps the two in sync).

export const THEMES = ["papir", "noc", "masina", "magla"] as const;
export type ThemeName = (typeof THEMES)[number];

export const THEME_PAPER: Record<ThemeName, string> = {
  papir: "#f7f3ea",
  noc: "#1b1c1f",
  masina: "#ede8dc",
  magla: "#e8ebed",
};

export function isTheme(value: unknown): value is ThemeName {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

// Mirror of the saved theme for the first paint only — Dexie is read too late
// and the page would flash in the wrong colors. Dexie stays the source of truth.
export const THEME_MIRROR_KEY = "momentum:theme";

/**
 * Runs inline in <head> before the page paints. No saved choice → no
 * data-theme, and the CSS follows the system (dark → noc).
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_MIRROR_KEY)});if(${JSON.stringify(
  THEMES,
)}.indexOf(t)>=0)document.documentElement.dataset.theme=t}catch(e){}`;

/** Applies a theme now and mirrors it for the next first paint; null = follow the system. */
export function applyTheme(theme: ThemeName | null) {
  const root = document.documentElement;
  if (theme) root.dataset.theme = theme;
  else delete root.dataset.theme;
  try {
    if (theme) localStorage.setItem(THEME_MIRROR_KEY, theme);
    else localStorage.removeItem(THEME_MIRROR_KEY);
  } catch {
    // Mirror only — the choice is saved in Dexie anyway.
  }
}

/** The theme on screen right now (saved choice, or the system default). */
export function currentTheme(): ThemeName {
  const set = document.documentElement.dataset.theme;
  if (isTheme(set)) return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "noc" : "papir";
}
