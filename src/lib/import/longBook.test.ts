// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { Packer } from "docx";
import { manuscriptDocx } from "@/lib/export/docx/manuscriptDocx";
import { buildBook } from "@/lib/export/typst/buildBook";
import { docxToHtml } from "./fromDocx";
import { htmlToBlocks } from "./fromHtml";
import { splitBook } from "./splitBook";
import { longParts, TEST_BOOK } from "./testBook";
import { auditWords, importedText } from "./wordAudit";

// I2: a whole novel (~80.000 words, 30 chapters) through the DOCX import. The
// times are printed (happy-dom in Node is slower than a browser).
describe("a long book", () => {
  it("80.000 words from Word: 30 chapters, no word lost", { timeout: 120_000 }, async () => {
    const parts = longParts();
    const buffer = await Packer.toBuffer(manuscriptDocx(buildBook(TEST_BOOK, parts), { author: "Ana", spacing: 2 }));

    let t = performance.now();
    const { html } = await docxToHtml(buffer);
    const docx = performance.now() - t;
    t = performance.now();
    const result = htmlToBlocks(html);
    const parse = performance.now() - t;
    t = performance.now();
    const split = splitBook(result.blocks, result.notes);
    const splitting = performance.now() - t;
    console.log(`[import] ${result.sourceText.split(/\s+/).length} words · DOCX → HTML ${Math.round(docx)} ms · HTML → blocks ${Math.round(parse)} ms · split ${Math.round(splitting)} ms`);

    expect(split.parts).toHaveLength(30);
    expect(split.parts.map((part) => part.title)).toEqual(parts.map((part) => part.title));
    expect(auditWords(result.sourceText, importedText(split.parts, split.titlePage), [...split.dropped, ...result.dropped])).toEqual({ missing: [], added: [] });
  });
});
