import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/react";
import { textToBlocks } from "./fromText";
import { linkPlainNotes } from "./plainNotes";
import { splitBook } from "./splitBook";
import { docText } from "./text";
import { auditWords, importedText } from "./wordAudit";

const refs = (blocks: JSONContent[]) => JSON.stringify(blocks).match(/"footnoteRef"/g)?.length ?? 0;

describe("linkPlainNotes", () => {
  it("TXT: a mark glued to a word and its note under „Napomene” become a real footnote", () => {
    const text = ["Tacit i Svetonije[1] beleže da je bila osuđivana.", "", "Napomene", "", "[1] Svetonije je pisao u delu De vita Caesarum („O", "životu careva”)."].join("\n");
    const { blocks, notes, dropped, unlinked } = linkPlainNotes(textToBlocks(text));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.content).toEqual([
      { type: "text", text: "Tacit i Svetonije" },
      { type: "footnoteRef", attrs: { id: [...notes.keys()][0] } },
      { type: "text", text: " beleže da je bila osuđivana." },
    ]);
    expect([...notes.values()]).toEqual([[{ type: "text", text: "Svetonije je pisao u delu De vita Caesarum („O životu careva”)." }]]);
    expect(dropped).toEqual(["[1]", "[1]", "Napomene"]);
    expect(unlinked).toBe(0);
  });

  it("PDF: a mark set apart (\" [6]\") before punctuation, the note's italic kept", () => {
    const blocks: JSONContent[] = [
      { type: "paragraph", content: [{ type: "text", text: "oko dve stotine pedeset [6]. Šta više" }] },
      { type: "paragraph", content: [{ type: "text", text: "[6] Ime " }, { type: "text", text: "cantarella", marks: [{ type: "italic" }] }, { type: "text", text: " pominje se." }] },
    ];
    const { blocks: out, notes } = linkPlainNotes(blocks);
    expect(out[0]!.content?.map((node) => node.text ?? node.type)).toEqual(["oko dve stotine pedeset", "footnoteRef", ". Šta više"]);
    expect([...notes.values()][0]).toEqual([
      { type: "text", text: "Ime " },
      { type: "text", text: "cantarella", marks: [{ type: "italic" }] },
      { type: "text", text: " pominje se." },
    ]);
  });

  it("numbering that starts over in each chapter: each note takes the nearest mark before it", () => {
    const text = ["Poglavlje 1", "Prvo[1].", "[1] Prva.", "Poglavlje 2", "Drugo[1].", "[1] Druga."].join("\n");
    const { blocks, notes } = linkPlainNotes(textToBlocks(text));
    expect(notes.size).toBe(2);
    const split = splitBook(blocks, notes);
    expect(split.parts.map((part) => docText(part.content))).toEqual(["Prvo.\nPrva.", "Drugo.\nDruga."]);
    expect(auditWords(text, importedText(split.parts), split.dropped.concat(["[1]", "[1]", "[1]", "[1]"]))).toEqual({ missing: [], added: [] });
  });

  it("a mark without a note, a note without a mark and „Napomene” with other text under it stay text", () => {
    const text = ["Tekst[2] i godina [1990].", "", "Napomene", "", "Ovde nema beleški.", "", "[3] Beleška bez oznake."].join("\n");
    const { blocks, notes, unlinked } = linkPlainNotes(textToBlocks(text));
    expect(notes.size).toBe(0);
    expect(unlinked).toBe(2);
    expect(refs(blocks)).toBe(0);
    expect(blocks).toHaveLength(4);
  });
});
