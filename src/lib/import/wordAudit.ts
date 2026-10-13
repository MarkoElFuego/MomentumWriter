import { HAS_WORD_CHAR } from "@/lib/text/countWords";
import type { ImportedPart, TitlePage } from "./splitBook";
import { docText } from "./text";

// Uvoz, pravilo 2: no word may get lost. Compares the words of the source with
// the words of the imported book, as multisets — the order and the layout may
// change, the words may not. What import is allowed to drop (chapter numbers,
// footnote markers) is handed in.

export interface WordAudit {
  /** Source words not found in the book. */
  missing: string[];
  /** Book words not in the source. */
  added: string[];
}

/** Lower case, letters and digits only: "Kofer," and "kofer" are the same word, "crno-beli" is "crnobeli". */
export function wordsOf(text: string): string[] {
  return text
    // "Svetonije[1]": a word and a footnote number.
    .replace(/\[(\d{1,4})\]/gu, " $1 ")
    .split(/\s+/u)
    .filter((token) => HAS_WORD_CHAR.test(token))
    .map((token) => token.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""));
}

function tally(words: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return counts;
}

/** a − b, as a list. */
function minus(a: Map<string, number>, b: Map<string, number>): string[] {
  return [...a].flatMap(([word, n]) => Array<string>(Math.max(0, n - (b.get(word) ?? 0))).fill(word));
}

function remove(list: string[], word: string): boolean {
  const i = list.indexOf(word);
  if (i === -1) return false;
  list.splice(i, 1);
  return true;
}

export function auditWords(source: string, imported: string, allowedRemoved: string[] = []): WordAudit {
  const before = tally(wordsOf(source));
  const after = tally(wordsOf(imported));
  const missing = minus(before, after);
  const added = minus(after, before);

  for (const word of wordsOf(allowedRemoved.join(" "))) remove(missing, word);
  // "rastav-⏎ljeno" → "rastavljeno": a word joined at a line end by „Sredi tekst”.
  for (const word of [...added]) {
    const head = missing.find((part) => word.startsWith(part) && part !== word && missing.includes(word.slice(part.length)));
    if (head === undefined) continue;
    remove(missing, head);
    remove(missing, word.slice(head.length));
    remove(added, word);
  }
  return { missing, added };
}

/**
 * The text an import keeps: parts with their footnotes, and the title page.
 * Part names are not text — they come from headings (in `dropped`), or are
 * Momentum's own, like „Posveta” for a dedication found by its layout.
 */
export function importedText(parts: ImportedPart[], titlePage?: TitlePage): string {
  return [titlePage ? docText(titlePage.content) : "", ...parts.map((part) => docText(part.content))].join("\n");
}
