import { endsMidSentence } from "./sentences";

/**
 * Gray completions only make sense where the author is extending an unfinished
 * sentence at the end of a paragraph — never mid-line, never over a selection.
 */
export function canSuggest(textBefore: string, textAfterInBlock: string, selectionEmpty: boolean): boolean {
  return selectionEmpty && textAfterInBlock.trim() === "" && endsMidSentence(textBefore);
}

/** The next chunk to accept word by word: leading space plus one word (with its punctuation). */
export function nextWord(suggestion: string): string {
  return suggestion.match(/^\s*\S+/u)?.[0] ?? "";
}
