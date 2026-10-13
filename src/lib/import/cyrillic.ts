import type { JSONContent } from "@tiptap/react";

// Uvoz (I2): Serbian Cyrillic → Latin, letter for letter — lossless, so the
// author's words stay the same words. Proofreading and suggestions work in
// Latin, so the preview offers it when most of the text is Cyrillic.

const LETTERS: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ђ: "đ", е: "e", ж: "ž", з: "z", и: "i", ј: "j", к: "k", л: "l", љ: "lj",
  м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t", ћ: "ć", у: "u", ф: "f", х: "h", ц: "c", ч: "č",
  џ: "dž", ш: "š",
};

const CYRILLIC = /[Ѐ-ӿ]/u;
const LETTER = /\p{L}/gu;

export const hasCyrillic = (text: string) => CYRILLIC.test(text);

/** Share of letters that are Cyrillic, 0–1. */
export function cyrillicShare(text: string): number {
  const letters = text.match(LETTER) ?? [];
  if (!letters.length) return 0;
  return letters.filter((letter) => CYRILLIC.test(letter)).length / letters.length;
}

export function toLatin(text: string): string {
  if (!hasCyrillic(text)) return text;
  const chars = [...text];
  return chars
    .map((char, i) => {
      const lower = char.toLowerCase();
      const latin = LETTERS[lower];
      if (latin === undefined) return char;
      if (char === lower) return latin;
      // Љ → "Lj" in "Љубав", "LJ" in "ЉУБАВ": the neighbouring letter decides.
      const next = chars[i + 1] ?? "";
      const previous = chars[i - 1] ?? "";
      const shouting = (next && next !== next.toLowerCase()) || (!/\p{L}/u.test(next) && previous && previous !== previous.toLowerCase());
      return shouting ? latin.toUpperCase() : latin.charAt(0).toUpperCase() + latin.slice(1);
    })
    .join("");
}

/** Every text node of the blocks, marks and all. */
export function blocksToLatin(blocks: JSONContent[]): JSONContent[] {
  return blocks.map((block) => ({
    ...block,
    ...(block.text !== undefined ? { text: toLatin(block.text) } : {}),
    ...(block.content ? { content: blocksToLatin(block.content) } : {}),
  }));
}
