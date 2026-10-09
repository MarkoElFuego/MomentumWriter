// Which characters a TrueType font can draw (its cmap table). Typst prints a
// missing glyph as an empty box without a warning — and in typst.ts 0.7 a
// missing glyph can even crash a later compile — so the export checks first.

/** Unicode code points the font has glyphs for (cmap formats 4 and 12). */
export function coveredCodePoints(font: Uint8Array): Set<number> {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  const u16 = (offset: number) => view.getUint16(offset);
  const u32 = (offset: number) => view.getUint32(offset);

  let cmap = -1;
  for (let i = 0; i < u16(4); i++) {
    const record = 12 + i * 16;
    if (String.fromCharCode(...font.subarray(record, record + 4)) === "cmap") cmap = u32(record + 8);
  }
  const covered = new Set<number>();
  if (cmap < 0) return covered;

  for (let i = 0; i < u16(cmap + 2); i++) {
    const table = cmap + u32(cmap + 4 + i * 8 + 4);
    const format = u16(table);
    if (format === 4) {
      const segments = u16(table + 6) / 2;
      for (let s = 0; s < segments; s++) {
        const end = u16(table + 14 + s * 2);
        const start = u16(table + 16 + segments * 2 + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) covered.add(c);
      }
    } else if (format === 12) {
      const groups = u32(table + 12);
      for (let g = 0; g < groups; g++) {
        const start = u32(table + 16 + g * 12);
        const end = u32(table + 20 + g * 12);
        for (let c = start; c <= end; c++) covered.add(c);
      }
    }
  }
  return covered;
}

/** Characters of `text` the font cannot draw, each once, in order of appearance. Whitespace is fine. */
export function missingCharacters(text: string, covered: Set<number>): string[] {
  const missing = new Set<string>();
  for (const char of text) {
    if (/\s/.test(char)) continue;
    if (!covered.has(char.codePointAt(0)!)) missing.add(char);
  }
  return [...missing];
}
