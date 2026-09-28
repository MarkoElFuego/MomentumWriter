// Break after . ! ? … (plus any closing quotes/brackets) followed by whitespace.
export const SENTENCE_BREAK = /(?<=[.!?…]["'“”’»)]*)\s+/u;
// Text that ends a sentence: . ! ? … optionally followed by closing quotes/brackets.
export const SENTENCE_END = /[.!?…]["'“”’»)]*$/u;

const HAS_WORD_CHAR = /[\p{L}\p{N}]/u;

export function splitSentences(text: string): string[] {
  return text
    .trim()
    .split(SENTENCE_BREAK)
    .filter((sentence) => sentence !== "");
}

/** True when the text (e.g. everything before the cursor) stops inside a sentence. */
export function endsMidSentence(text: string): boolean {
  const paragraph = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .findLast((p) => HAS_WORD_CHAR.test(p));
  return paragraph !== undefined && !SENTENCE_END.test(paragraph);
}
