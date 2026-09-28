import { HAS_WORD_CHAR } from "./countWords";
import { splitSentences } from "./sentences";

/**
 * The sentence the writer stopped on — possibly unfinished. Long sentences
 * keep their end (that's where the cursor was) behind a leading "…".
 */
export function lastSentence(text: string, max = 160): string {
  const paragraph = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .findLast((p) => HAS_WORD_CHAR.test(p));
  if (!paragraph) return "";

  const sentence = splitSentences(paragraph).findLast((s) => HAS_WORD_CHAR.test(s)) ?? paragraph;
  if (sentence.length <= max) return sentence;

  const tail = sentence.slice(sentence.length - (max - 1));
  const firstSpace = tail.indexOf(" ");
  return `…${firstSpace >= 0 && firstSpace < max / 2 ? tail.slice(firstSpace + 1) : tail}`;
}
