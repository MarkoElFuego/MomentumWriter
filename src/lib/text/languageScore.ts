// Language score (U7): computed from the language check's open corrections —
// no extra AI calls. Called "Jezik" in the UI, never a grade of the writing.

const WEIGHT = { diacritic: 1, grammar: 3 } as const;
const POINTS_PER_ERROR_PER_100_WORDS = 5;
/** Below this share of checked words, a chapter's score is not changed. */
export const MIN_CHECKED_SHARE = 0.5;

export interface LanguageCounts {
  /** Words the score is about (only checked paragraphs). */
  words: number;
  diacritics: number;
  grammar: number;
}

/** 100 − round(weighted errors per 100 words × 5), kept in 0–100; no words → no score. */
export function languageScore({ words, diacritics, grammar }: LanguageCounts): number | null {
  if (words <= 0) return null;
  const weighted = diacritics * WEIGHT.diacritic + grammar * WEIGHT.grammar;
  const score = 100 - Math.round((weighted / words) * 100 * POINTS_PER_ERROR_PER_100_WORDS);
  return Math.min(100, Math.max(0, score));
}

/**
 * A chapter's score when the author leaves it — or null when too little of it
 * was checked (then the previous score stays).
 */
export function chapterLanguageScore(totalWords: number, counts: LanguageCounts): number | null {
  if (totalWords <= 0 || counts.words < MIN_CHECKED_SHARE * totalWords) return null;
  return languageScore(counts);
}

interface ScoredPart {
  id: string;
  languageScore?: { score: number; words: number };
}

/**
 * The book: chapters with a score, weighted by their words. The part open in
 * the editor never counts — it is still being written.
 */
export function bookLanguageScore(parts: ScoredPart[], openPartId?: string): number | null {
  let words = 0;
  let sum = 0;
  for (const part of parts) {
    if (part.id === openPartId || !part.languageScore || part.languageScore.words <= 0) continue;
    words += part.languageScore.words;
    sum += part.languageScore.score * part.languageScore.words;
  }
  return words > 0 ? Math.round(sum / words) : null;
}
