// @vitest-environment happy-dom
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/react";
import { docFromJSON } from "@/components/editor/contentSchema";
import { docxToHtml } from "./fromDocx";
import { pagesToHtml, readPdfPages } from "./fromPdf";
import { decodeText, fromHtmlText, fromPlainText, prepare, type ImportSource } from "./read";
import { docText } from "./text";
import { auditWords, importedText } from "./wordAudit";

// The author's own manuscripts in scripts/import-samples/ (not in git): every
// file is imported and checked like the round trips. Skipped where the folder
// is missing (CI, other machines). `IMPORT_SAMPLES_LOG=1` prints what came out.

const DIR = "scripts/import-samples";
const files = existsSync(DIR) ? readdirSync(DIR).filter((name) => /\.(docx|pdf|txt)$/iu.test(name)) : [];

async function load(name: string): Promise<ImportSource> {
  const bytes = new Uint8Array(readFileSync(join(DIR, name)));
  if (name.endsWith(".txt")) return fromPlainText("txt", decodeText(bytes));
  if (name.endsWith(".docx")) return fromHtmlText("docx", (await docxToHtml(bytes)).html);
  // The legacy pdf.js build runs in Node; the app loads the regular one with its worker.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: bytes, fontExtraProperties: true, disableFontFace: true });
  const html = pagesToHtml(await readPdfPages(await task.promise));
  await task.destroy();
  return fromHtmlText("pdf", html, {}, { pdfFootnotes: true });
}

const notes = (content: JSONContent) => content.content?.find((block) => block.type === "footnotes")?.content ?? [];

describe.skipIf(!files.length)("the author's samples", () => {
  it.each(files)("%s", { timeout: 60_000 }, async (name) => {
    const source = await load(name);
    const split = prepare(source, false);
    for (const part of split.parts) docFromJSON(part.content, "sr-Latn").check();
    if (process.env.IMPORT_SAMPLES_LOG) {
      console.log(`== ${name}\n${split.parts.map((p) => `${p.kind} „${p.title}” ${p.words} reči, fusnote ${notes(p.content).length}: ${notes(p.content).map((n) => docText({ content: [n] }).slice(0, 40)).join(" | ")}`).join("\n")}`);
    }
    expect(split.recognized).toBe(true);
    // Every source, PDF too: real footnotes in the chapter they belong to, none left as text.
    if (name.startsWith("deset-trovaca")) {
      expect(split.parts.map((part) => notes(part.content).length)).toEqual([0, 0, 1, 1, 1, 2, 1, 0, 0]);
      expect(source.warnings.plainFootnotes).toBe(0);
    }
    expect(auditWords(split.sourceText, importedText(split.parts, split.titlePage), [...split.dropped, ...source.dropped])).toEqual({ missing: [], added: [] });
  });
});
