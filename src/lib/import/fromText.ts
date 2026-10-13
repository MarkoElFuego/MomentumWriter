import type { JSONContent } from "@tiptap/react";
import { headingRole, isSceneBreakText } from "./chapterHeading";

// Plain text (TXT, or a paste without HTML) → paragraphs. With empty lines
// between paragraphs a single line break is a line split by the old editor or
// e-mail, so the lines join (through „Sredi tekst” later); without them every
// line is a paragraph.

const paragraph = (lines: string[]): JSONContent => ({
  type: "paragraph",
  content: lines.flatMap((line, i): JSONContent[] => [
    ...(i > 0 ? [{ type: "hardBreak" }] : []),
    ...(line ? [{ type: "text", text: line }] : []),
  ]),
});

/** A line that must stay on its own even inside a block of lines: a heading or a scene break. */
const standsAlone = (line: string) => isSceneBreakText(line) || headingRole(line) !== null;

export function textToBlocks(raw: string): JSONContent[] {
  const text = raw.replace(/^﻿/u, "").replace(/\r\n?/gu, "\n");
  const blocks: JSONContent[] = [];

  if (!/\n[ \t]*\n/u.test(text)) {
    for (const line of text.split("\n")) if (line.trim()) blocks.push(paragraph([line]));
    return blocks;
  }

  for (const chunk of text.split(/\n[ \t]*\n/u)) {
    let lines: string[] = [];
    const flush = () => {
      if (lines.length) blocks.push(paragraph(lines));
      lines = [];
    };
    for (const line of chunk.split("\n")) {
      if (!line.trim()) continue;
      if (standsAlone(line)) {
        flush();
        blocks.push(paragraph([line]));
      } else {
        lines.push(line);
      }
    }
    flush();
  }
  return blocks;
}
