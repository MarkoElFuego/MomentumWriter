// A token counts as a word only if it has at least one letter or digit,
// so standalone "—", "…" or „ are ignored.
const HAS_WORD_CHAR = /[\p{L}\p{N}]/u;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).filter((token) => HAS_WORD_CHAR.test(token)).length;
}
