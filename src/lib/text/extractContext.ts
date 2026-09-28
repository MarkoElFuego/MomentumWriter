import { countWords, HAS_WORD_CHAR } from "./countWords";
import { splitSentences } from "./sentences";

// Structural type so this stays pure: a ProseMirror Node satisfies it.
export interface TextSource {
  textBetween(from: number, to: number, blockSeparator?: string): string;
}

const PARAGRAPH_SEPARATOR = "\n\n";

export function extractContext(doc: TextSource, pos: number, maxWords = 400): string {
  const paragraphs = doc
    .textBetween(0, pos, PARAGRAPH_SEPARATOR)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");

  const kept: string[] = [];
  let budget = maxWords;

  for (let i = paragraphs.length - 1; i >= 0 && budget > 0; i--) {
    const paragraph = paragraphs[i]!;
    const words = countWords(paragraph);
    if (words <= budget) {
      kept.unshift(paragraph);
      budget -= words;
      continue;
    }

    const tail = sentenceTail(paragraph, budget);
    if (tail) {
      kept.unshift(tail);
    } else if (kept.length === 0) {
      // The paragraph at the cursor is one endless sentence — still send something.
      kept.unshift(wordTail(paragraph, budget));
    }
    break;
  }

  return kept.join(PARAGRAPH_SEPARATOR);
}

function sentenceTail(paragraph: string, budget: number): string {
  const sentences = splitSentences(paragraph);
  const kept: string[] = [];
  let words = 0;

  for (let i = sentences.length - 1; i >= 0; i--) {
    const sentence = sentences[i]!;
    const count = countWords(sentence);
    if (words + count > budget) break;
    kept.unshift(sentence);
    words += count;
  }

  return kept.join(" ");
}

function wordTail(paragraph: string, budget: number): string {
  const tokens = paragraph.split(/\s+/);
  let start = tokens.length;
  let words = 0;

  while (start > 0 && words < budget) {
    start--;
    if (HAS_WORD_CHAR.test(tokens[start]!)) words++;
  }

  return `…${tokens.slice(start).join(" ")}`;
}
