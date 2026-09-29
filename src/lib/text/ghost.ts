import { endsSentence } from "./sentences";

/**
 * Where the cursor stands, judged only by the current paragraph:
 * - "mid"   — inside an unfinished sentence → gray completion of that sentence
 * - "after" — right after a finished sentence → gray start of the next one
 * - "empty" — empty paragraph → no AI, only the quiet "stuck?" hint
 * - "none"  — a selection, or text after the cursor → nothing
 */
export type CursorSituation = "mid" | "after" | "empty" | "none";

export function cursorSituation(
  blockTextBefore: string,
  textAfterInBlock: string,
  selectionEmpty: boolean,
): CursorSituation {
  if (!selectionEmpty || textAfterInBlock.trim() !== "") return "none";
  if (blockTextBefore.trim() === "") return "empty";
  return endsSentence(blockTextBefore) ? "after" : "mid";
}

/**
 * "/" opens the Spark menu only where it can't be part of a word: at the start
 * of an empty paragraph or right after a space. "i/ili" and "1/2" type normally.
 */
export function slashOpensMenu(blockTextBefore: string): boolean {
  return blockTextBefore === "" || /\s$/u.test(blockTextBefore);
}

/** The next chunk to accept word by word: leading space plus one word (with its punctuation). */
export function nextWord(suggestion: string): string {
  return suggestion.match(/^\s*\S+/u)?.[0] ?? "";
}
