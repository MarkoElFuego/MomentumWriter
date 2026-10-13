// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { buildBook } from "@/lib/export/typst/buildBook";
import { nodeTypst } from "@/lib/export/typst/nodeTypst";
import { manuscriptTemplate } from "@/lib/export/typst/templates/manuscript.typ";
import { printTemplate } from "@/lib/export/typst/templates/print.typ";
import { countWords } from "@/lib/text/countWords";
import { htmlToBlocks } from "./fromHtml";
import { pagesToHtml, readPdfPages, unspace } from "./fromPdf";
import { splitBook } from "./splitBook";
import { longParts, TEST_BOOK, testParts } from "./testBook";
import { docText } from "./text";
import { auditWords, importedText } from "./wordAudit";

async function pdf(source: string): Promise<Uint8Array> {
  const compiler = await nodeTypst();
  compiler.addSource("/main.typ", source);
  const result = await compiler.compile({ mainFilePath: "/main.typ", format: 1, diagnostics: "full" });
  if (!result.result) throw new Error(JSON.stringify(result.diagnostics));
  return result.result;
}

async function importPdf(data: Uint8Array) {
  // The legacy build runs in Node (tests); the app loads the regular one with its worker.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data, fontExtraProperties: true, disableFontFace: true });
  const html = pagesToHtml(await readPdfPages(await task.promise));
  await task.destroy();
  const result = htmlToBlocks(html);
  return { result, split: splitBook(result.blocks, result.notes) };
}

const original = testParts();
const originalWords = original.reduce((sum, part) => sum + countWords(docText(part.content)), 0);

/** Same parts and names; words within 1% (footnote numbers); no page numbers or running heads in the text. */
function expectSameParts(split: Awaited<ReturnType<typeof importPdf>>["split"], book = original) {
  expect(split.parts.map((part) => [part.kind, part.title])).toEqual(book.map((part) => [part.kind, part.title]));
  const text = importedText(split.parts);
  const words = countWords(text);
  const expected = book.reduce((sum, part) => sum + countWords(docText(part.content)), 0);
  expect(Math.abs(words - expected) / expected).toBeLessThanOrEqual(0.01 + 4 / expected);
  expect(text).not.toMatch(/^\s*\d+\s*$/mu);
  expect(text.toUpperCase()).not.toContain(TEST_BOOK.title.toUpperCase().split(" ").join(""));
}

describe("unspace", () => {
  it("joins letter-spaced type back", () => {
    expect(unspace("P O G L AV L J E I I")).toBe("POGLAVLJE II");
    expect(unspace("A NA P E T R O V I Ć")).toBe("ANAPETROVIĆ");
    expect(unspace("Petar je zastao.")).toBe("Petar je zastao.");
  });
});

describe("round trip: export to PDF → import", () => {
  const model = buildBook(TEST_BOOK, original);

  it("„Knjiga za štampu” (A5)", { timeout: 60_000 }, async () => {
    const { result, split } = await importPdf(await pdf(printTemplate(model, { size: "a5", author: "Ana Petrović" })));
    expectSameParts(split);
    // Italic and bold come back from the font names; the footnote text is there as text.
    expect(JSON.stringify(split.parts[2]!.content)).toContain('"text":"niko nije ni pitao","marks":[{"type":"italic"}]');
    expect(docText(split.parts[2]!.content)).toContain("Stanica u Lapovu.");
    expect(split.titlePage?.title).toBe("Kiša nad gradom");
    expect(result.blocks.some((block) => block.type === "pageBreak")).toBe(true);
    expect(originalWords).toBeGreaterThan(0);
  });

  it("„Rukopis za izdavača” (PDF)", { timeout: 60_000 }, async () => {
    const { split } = await importPdf(await pdf(manuscriptTemplate(model, { author: "Ana Petrović", contact: "ana@primer.rs", spacing: 2 })));
    expectSameParts(split);
  });

  it("a long book: every chapter, nothing lost", { timeout: 120_000 }, async () => {
    const parts = longParts(20_000, 8);
    const { result, split } = await importPdf(await pdf(printTemplate(buildBook(TEST_BOOK, parts), { size: "a5" })));
    expectSameParts(split, parts);
    const audit = auditWords(result.sourceText, importedText(split.parts, split.titlePage), [...split.dropped, ...result.dropped]);
    expect(audit).toEqual({ missing: [], added: [] });
  });
});

describe("a PDF without text", () => {
  it("is a scan: refused with its own reason", { timeout: 60_000 }, async () => {
    const data = await pdf(`#set page(width: 10cm, height: 10cm)\n#rect(width: 5cm, height: 5cm)`);
    await expect(importPdf(data)).rejects.toMatchObject({ reason: "scan" });
  });
});
