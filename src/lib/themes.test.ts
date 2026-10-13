import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_SWATCH, THEMES } from "./themes";

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

  it("the accent (links like „pokaži”) is readable on the paper and on its own soft ground (≥ 4.5)", () => {
    expect(on("--accent")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(vars["--accent"]!, vars["--accent-soft"]!)).toBeGreaterThanOrEqual(4.5);
  });

  it("the accent is never red — it never means an error", () => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(vars["--accent"]!.slice(i, i + 2), 16));
    expect(r! > g! * 1.4 && r! > b! * 1.4).toBe(false);
  });

  it("the soft accent is the accent mixed 14% into the paper", () => {
    const mix = [1, 3, 5]
      .map((i) => Math.round(parseInt(vars["--accent"]!.slice(i, i + 2), 16) * 0.14 + parseInt(vars["--paper"]!.slice(i, i + 2), 16) * 0.86))
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    expect(vars["--accent-soft"]).toBe(`#${mix}`);
  });

  it("the theme picker draws the stylesheet's colors", () => {
    expect(THEME_SWATCH[theme]).toMatchObject({ paper: vars["--paper"], ink: vars["--ink"], accent: vars["--accent"] });
  });

  it("sets its own font", () => {
    expect(vars["--font-text"]).toBeTruthy();
  });
});
