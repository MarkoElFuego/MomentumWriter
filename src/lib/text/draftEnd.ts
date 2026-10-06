import { HAS_WORD_CHAR } from "./countWords";
import { lastSentence } from "./lastSentence";
import { splitSentences } from "./sentences";

// Put do kraja (Tiron T7): the countdown near the end and the quiet screen
// when the first draft is done. Pure — the screens hand in the texts.

/** One page of a printed novel, roughly. */
export const WORDS_PER_PAGE = 300;

/** Pages left to the planned length; 0 or less once it is reached. */
export function pagesLeft(totalWords: number, targetWords: number): number {
  return Math.ceil((targetWords - totalWords) / WORDS_PER_PAGE);
}

/** The book in pages — at least one once there is any text. */
export function pageCount(totalWords: number): number {
  return totalWords === 0 ? 0 : Math.max(1, Math.round(totalWords / WORDS_PER_PAGE));
}

/** Days on which the book's word total moved — days of writing, not of opening it. */
export function writingDays(stats: { startWordTotal: number; endWordTotal: number }[]): number {
  return stats.filter((stat) => stat.endWordTotal !== stat.startWordTotal).length;
}

/** The first sentence of the first paragraph that has words in it. */
export function firstSentence(text: string): string {
  const paragraph = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .find((p) => HAS_WORD_CHAR.test(p));
  if (!paragraph) return "";
  return splitSentences(paragraph).find((s) => HAS_WORD_CHAR.test(s))?.trim() ?? paragraph;
}

export interface DraftPartText {
  kind: "front" | "chapter" | "back";
  /** Main text only — no footnotes. */
  text: string;
}

/**
 * The novel's first and last sentence: from the chapters (a dedication or a
 * preface is not where the story starts); a book without chapters uses all its parts.
 */
export function draftBookends(parts: DraftPartText[]): { first: string; last: string } {
  const withText = parts.filter((part) => HAS_WORD_CHAR.test(part.text));
  const chapters = withText.filter((part) => part.kind === "chapter");
  const pool = chapters.length ? chapters : withText;
  const firstPart = pool[0];
  const lastPart = pool.at(-1);
  return {
    first: firstPart ? firstSentence(firstPart.text) : "",
    // Whole, never cut with "…" — this is the book's last sentence.
    last: lastPart ? lastSentence(lastPart.text, Number.POSITIVE_INFINITY) : "",
  };
}
