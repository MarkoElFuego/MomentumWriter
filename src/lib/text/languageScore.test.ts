import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import { bookLanguageScore, chapterLanguageScore, languageScore } from "./languageScore";

describe("languageScore", () => {
  it("is 100 without errors", () => {
    expect(languageScore({ words: 500, diacritics: 0, grammar: 0 })).toBe(100);
  });

  it("follows the formula: 100 − round(weighted errors per 100 words × 5)", () => {
    // 2 diacritics + 1 grammar = 5 weighted in 200 words = 2.5 per 100 → 12.5 → 13
    expect(languageScore({ words: 200, diacritics: 2, grammar: 1 })).toBe(87);
  });

  it("lets a missing diacritic cost less than a grammar mistake", () => {
    const diacritic = languageScore({ words: 100, diacritics: 1, grammar: 0 })!;
    const grammar = languageScore({ words: 100, diacritics: 0, grammar: 1 })!;
    expect(diacritic).toBeGreaterThan(grammar);
  });

  it("stays within 0–100", () => {
    expect(languageScore({ words: 10, diacritics: 0, grammar: 20 })).toBe(0);
  });

  it("gives an empty chapter no score", () => {
    expect(languageScore({ words: 0, diacritics: 0, grammar: 0 })).toBeNull();
    expect(chapterLanguageScore(0, { words: 0, diacritics: 0, grammar: 0 })).toBeNull();
  });

  it("leaves a chapter unscored when less than half of it was checked", () => {
    expect(chapterLanguageScore(1000, { words: 499, diacritics: 0, grammar: 0 })).toBeNull();
    expect(chapterLanguageScore(1000, { words: 500, diacritics: 0, grammar: 0 })).toBe(100);
  });
});

describe("bookLanguageScore", () => {
  const part = (id: string, score: number, words: number) => ({ id, languageScore: { score, words } });

  it("weights chapters by their words and skips those without a score", () => {
    expect(bookLanguageScore([part("a", 100, 300), part("b", 80, 100), { id: "c" }])).toBe(95);
  });

  it("never counts the chapter open in the editor", () => {
    const parts = [part("a", 100, 300), part("open", 0, 3000)];
    expect(bookLanguageScore(parts, "open")).toBe(100);
    expect(bookLanguageScore([part("open", 90, 100)], "open")).toBeNull();
  });
});

describe("Jezik — counts in Serbian", () => {
  it("uses the right plural (1, 2–4, 5+, 11–14, 21)", () => {
    expect(copy.tiron.languageHere(1, 0)).toBe("ovde: 1 kvačica");
    expect(copy.tiron.languageHere(4, 1)).toBe("ovde: 4 kvačice · 1 gramatika");
    expect(copy.tiron.languageHere(5, 2)).toBe("ovde: 5 kvačica · 2 gramatike");
    expect(copy.tiron.languageHere(11, 0)).toBe("ovde: 11 kvačica");
    expect(copy.tiron.languageHere(12, 0)).toBe("ovde: 12 kvačica");
    expect(copy.tiron.languageHere(21, 0)).toBe("ovde: 21 kvačica");
    expect(copy.tiron.languageHere(22, 0)).toBe("ovde: 22 kvačice");
    expect(copy.tiron.languageHere(0, 3)).toBe("ovde: 3 gramatike");
  });
});
