// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/react";
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { docFromJSON } from "@/components/editor/contentSchema";
import { kindleDocx, manuscriptDocx } from "@/lib/export/docx/manuscriptDocx";
import { buildBook } from "@/lib/export/typst/buildBook";
import { countWords } from "@/lib/text/countWords";
import { docxToHtml } from "./fromDocx";
import { decodeText, prepare, readPaste, type ImportSource } from "./read";
import { htmlToBlocks } from "./fromHtml";
import { splitBook, type ImportedPart } from "./splitBook";
import { TEST_BOOK, testParts } from "./testBook";
import { docText } from "./text";
import { auditWords, importedText } from "./wordAudit";

function marked(content: JSONContent, mark: string): string[] {
  const out: string[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === "text" && node.marks?.some((m) => m.type === mark)) out.push(node.text!.trim());
    node.content?.forEach(walk);
  };
  walk(content);
  return out.filter(Boolean);
}

/** What must survive a round trip: words, block kinds and levels, centered lines, footnotes, italic and bold. */
function shape(content: JSONContent) {
  const body = (content.content ?? []).filter((block) => block.type !== "footnotes");
  const notes = content.content?.find((block) => block.type === "footnotes")?.content ?? [];
  return {
    words: countWords(docText(content)),
    blocks: body.map((block) => (block.type === "heading" ? `heading${block.attrs?.level}` : block.type)),
    centered: body.filter((block) => block.attrs?.textAlign === "center").map((block) => docText({ content: [block] })),
    notes: notes.map((note) => docText({ content: [note] })),
    italic: marked(content, "italic"),
    bold: marked(content, "bold"),
  };
}

async function importDocx(document: Document) {
  const { html, title } = await docxToHtml(await Packer.toBuffer(document));
  const result = htmlToBlocks(html);
  const split = splitBook(result.blocks, result.notes);
  for (const part of split.parts) docFromJSON(part.content, "sr-Latn").check();
  expect(auditWords(result.sourceText, importedText(split.parts, split.titlePage), [...split.dropped, ...result.dropped])).toEqual({ missing: [], added: [] });
  return { title, split };
}

function expectSameBook(parts: ImportedPart[]) {
  const original = testParts();
  expect(parts.map((part) => [part.kind, part.title])).toEqual(original.map((part) => [part.kind, part.title]));
  parts.forEach((part, i) => {
    const before = shape(original[i]!.content);
    // The dedication is centered on its page in Word; that's the export's layout, not the text.
    if (original[i]!.title === "Posveta") before.centered = shape(part.content).centered;
    expect(shape(part.content)).toEqual(before);
  });
}

describe("round trip: export to Word → import", () => {
  const model = buildBook(TEST_BOOK, testParts());

  it("„Rukopis za izdavača (DOCX)” comes back as the same book (without the manuscript title page)", async () => {
    const { title, split } = await importDocx(manuscriptDocx(model, { author: "Ana Petrović", contact: "ana@primer.rs", spacing: 2 }));
    expect(title).toBe("Kiša nad gradom");
    expect(split.titlePage?.words).toBeGreaterThan(0);
    expectSameBook(split.parts);
  });

  it("„DOCX za Kindle” comes back as the same book", async () => {
    const { split } = await importDocx(kindleDocx(model, { author: "Ana Petrović" }));
    expect(split.titlePage?.title).toBe("Kiša nad gradom");
    expectSameBook(split.parts);
  });
});

describe("Word files made elsewhere", () => {
  const chapterText = (n: number) => `Tekst poglavlja ${n}, sa ${n} rečenica.`;

  it("Heading 1 chapters with a Title style on top", async () => {
    const document = new Document({
      sections: [
        {
          children: [
            new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("Moja knjiga")] }),
            ...[1, 2, 3].flatMap((n) => [
              new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`Poglavlje ${n}: Ime ${n}`)] }),
              new Paragraph({ children: [new TextRun(chapterText(n))] }),
              new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Podnaslov")] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Kurziv u sredini", italics: true })] }),
            ]),
          ],
        },
      ],
    });
    const { split } = await importDocx(document);
    expect(split.titlePage?.title).toBe("Moja knjiga");
    expect(split.parts.map((part) => [part.kind, part.title])).toEqual([1, 2, 3].map((n) => ["chapter", `Ime ${n}`]));
    expect(shape(split.parts[0]!.content)).toMatchObject({ blocks: ["paragraph", "heading1", "paragraph"], centered: ["Kurziv u sredini"], italic: ["Kurziv u sredini"] });
  });

  it("no styles at all — chapters only as paragraphs „Poglavlje N”", async () => {
    const document = new Document({
      sections: [{ children: [1, 2, 3].flatMap((n) => [new Paragraph(`Poglavlje ${n}`), new Paragraph(chapterText(n))]) }],
    });
    const { split } = await importDocx(document);
    expect(split.parts.map((part) => [part.kind, part.title, part.words])).toEqual([1, 2, 3].map(() => ["chapter", "", 6]));
  });
});

describe("plain text sources", () => {
  it("TXT in Windows-1250 with č ć đ š ž", () => {
    // "Đorđe čeka ćup, šaš i žabe." in Windows-1250.
    const bytes = Uint8Array.from([0xd0, 0x6f, 0x72, 0xf0, 0x65, 0x20, 0xe8, 0x65, 0x6b, 0x61, 0x20, 0xe6, 0x75, 0x70, 0x2c, 0x20, 0x9a, 0x61, 0x9a, 0x20, 0x69, 0x20, 0x9e, 0x61, 0x62, 0x65, 0x2e]);
    expect(decodeText(bytes)).toBe("Đorđe čeka ćup, šaš i žabe.");
  });

  it("UTF-8 stays UTF-8; UTF-16 with a BOM is read; a binary file is refused", () => {
    expect(decodeText(new TextEncoder().encode("﻿Đorđe"))).toBe("Đorđe");
    expect(decodeText(Uint8Array.from([0xff, 0xfe, 0x10, 0x01, 0x6f, 0x00]))).toBe("Đo");
    expect(() => decodeText(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]))).toThrow();
  });

  it("a paste uses the HTML when there is some, else the text", () => {
    const html = readPaste("<p>Obično <em>kurziv</em>.</p>", "Obično kurziv.");
    expect(html.blocks[0]!.content?.[1]).toMatchObject({ text: "kurziv", marks: [{ type: "italic" }] });
    const text = readPaste("", "Prvi red.\nDrugi red.");
    expect(text).toMatchObject({ kind: "paste", words: 4 });
    expect(() => readPaste("", "   ")).toThrow();
  });

  it("Cyrillic: offered in Latin, chapters found either way, no word lost", () => {
    const source: ImportSource = readPaste("", "Поглавље 1: Љубав\nЂорђе је чекао.\nПоглавље 2\nЊИВА је ЏИНОВСКА.");
    expect(source.warnings.cyrillic).toBe(true);

    const latin = prepare(source, true);
    expect(latin.parts.map((part) => part.title)).toEqual(["Ljubav", ""]);
    expect(docText(latin.parts[1]!.content)).toBe("NJIVA je DŽINOVSKA.");
    expect(auditWords(latin.sourceText, importedText(latin.parts), latin.dropped)).toEqual({ missing: [], added: [] });

    const cyrillic = prepare(source, false);
    expect(cyrillic.parts.map((part) => part.title)).toEqual(["Љубав", ""]);
    expect(docText(cyrillic.parts[0]!.content)).toBe("Ђорђе је чекао.");
  });
});
