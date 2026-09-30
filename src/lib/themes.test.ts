import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_PAPER, THEMES } from "./themes";

// Reads the real stylesheet so the test checks what the browser gets.
const css = readFileSync(new URL("../styles/themes.css", import.meta.url), "utf8");

function themeVars(theme: string): Record<string, string> {
  const block = new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1];
  if (!block) throw new Error(`no block for ${theme}`);
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio, 1–21. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

describe.each(THEMES)("theme %s", (theme) => {
  const vars = themeVars(theme);
  const on = (name: string) => contrast(vars[name]!, vars["--paper"]!);

  it("text is comfortably readable (≥ 7)", () => {
    expect(on("--ink")).toBeGreaterThanOrEqual(7);
  });

  it("muted UI text passes WCAG AA (≥ 4.5)", () => {
    expect(on("--ink-muted")).toBeGreaterThanOrEqual(4.5);
  });

  it("gray suggestions are readable but clearly fainter than the text", () => {
    expect(on("--ghost")).toBeGreaterThanOrEqual(3);
    expect(on("--ghost")).toBeLessThan(on("--ink-muted"));
  });

  it("underlines stand out from the paper (≥ 3)", () => {
    expect(on("--underline-diacritic")).toBeGreaterThanOrEqual(3);
    expect(on("--underline-grammar")).toBeGreaterThanOrEqual(3);
  });

  it("the menu swatch matches the stylesheet", () => {
    expect(vars["--paper"]).toBe(THEME_PAPER[theme]);
  });

  it("sets its own font", () => {
    expect(vars["--font-text"]).toBeTruthy();
  });
});
