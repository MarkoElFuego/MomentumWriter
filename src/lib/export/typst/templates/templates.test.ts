import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/react";
import { copy } from "@/lib/copy";
import type { Book, Part, PartKind } from "@/lib/db/schema";
import { buildBook } from "../buildBook";
import { runTypst } from "../nodeTypst";
import { lines, surname, typstLang } from "./common";
import { manuscriptTemplate } from "./manuscript.typ";
import { PRINT_SIZES, printTemplate } from "./print.typ";

const t = (value: string, ...marks: string[]): JSONContent => ({
  type: "text",
  text: value,
  ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}),
});
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

// Every kind of node and every character that could break the layout.
const chapter = doc(
  p(t("Đorđe je čekao"), { type: "footnoteRef", attrs: { id: "a" } }, t(" na stanici. "), t("Tiho", "italic"), t(", "), t("jasno", "bold"), t(".")),
  p(t("- Gde si? # $5 @ana <x> [1] *ne* _ne_ // ne 1. maj -- ... \"a\" 'b' \\ ~")),
  { type: "heading", attrs: { level: 1 }, content: [t("= Međunaslov")] },
  { type: "heading", attrs: { level: 2 }, content: [t("Manji")] },
  { type: "blockquote", content: [p(t("Citat."))] },
  { type: "sceneBreak" },
  { type: "paragraph", attrs: { textAlign: "center" }, content: [t("Centrirano")] },
  p(t("Red"), { type: "hardBreak" }, t("drugi")),
  { type: "bulletList", content: [{ type: "listItem", content: [p(t("stavka"))] }] },
  { type: "footnotes", content: [{ type: "footnote", attrs: { id: "a" }, content: [t("Napomena sa "), t("kurzivom", "italic"), t(".")] }] },
);

const book: Book = { id: "b", title: "Kiša #1 \"noću\"", language: "sr-Latn", createdAt: 0, updatedAt: 0, genre: "triler" };
let order = 0;
const part = (kind: PartKind, title: string, content: JSONContent): Part => ({
  id: `p${(order += 1)}`,
  bookId: "b",
  kind,
  title,
  order,
  content,
  wordCount: 40_000,
  createdAt: 0,
  updatedAt: 0,
});
const exportBook = buildBook(book, [
  part("front", "Naslovna", doc(p(t("Ana Petrović")))),
  part("front", "Posveta", doc(p(t("Mami.")))),
  part("chapter", "Dolazak $ #", chapter),
  part("chapter", "", doc(p())),
  part("chapter", "", doc(p(t("Kraj.")))),
  part("back", "Zahvalnica", doc(p(t("Hvala.")))),
]);

describe("printTemplate", () => {
  it.each(PRINT_SIZES.flatMap((size) => [{ size, toc: false }, { size, toc: true }]))("compiles the whole book without errors (%o)", async (options) => {
    const run = await runTypst(printTemplate(exportBook, options), "footnote");
    expect(run.errors).toEqual([]);
    expect(run.query).toHaveLength(1);
  });

  // Page numbers of every section start, the pages that show a number, and the running heads.
  async function layout(toc: boolean) {
    const probe = `
#context [#metadata((
  starts: query(<section>).map(m => m.location().page()),
  total: counter(page).final().first(),
)) <probe>]`;
    const run = await runTypst(printTemplate(exportBook, { size: "a5", toc }) + probe, "<probe>", "value");
    expect(run.errors).toEqual([]);
    return run.query?.[0] as { starts: number[]; total: number };
  }

  it("starts every part on a right-hand (odd) page", async () => {
    const { starts } = await layout(false);
    // Title page, dedication, chapter I, chapter III, Zahvalnica.
    expect(starts).toHaveLength(5);
    expect(starts.every((page) => page % 2 === 1)).toBe(true);
  });

  it("puts the table of contents after the front matter, only when asked", async () => {
    const without = await layout(false);
    const withToc = await layout(true);
    expect(withToc.starts).toHaveLength(6);
    expect(withToc.starts[2]).toBe(without.starts[2]);
    const source = printTemplate(exportBook, { size: "a5", toc: true });
    expect(source.indexOf(copy.export.contents)).toBeLessThan(source.indexOf("Dolazak"));
    expect(source).toContain("[I · Dolazak \\$ \\#]");
    expect(printTemplate(exportBook, { size: "a5" })).not.toContain(copy.export.contents);
  });

  it("keeps widows and orphans off the page edges and does not indent after headings", () => {
    const source = printTemplate(exportBook, { size: "a5" });
    expect(source).toContain("costs: (widow: 1000%, orphan: 1000%)");
    expect(source).toContain("first-line-indent: (amount: 1.2em, all: false)");
  });

  it("scales the margins and the text with the page", () => {
    expect(printTemplate(exportBook, { size: "a5" })).toContain("size: 10.5pt");
    expect(printTemplate(exportBook, { size: "6x9" })).toContain("size: 11pt");
    expect(printTemplate(exportBook, { size: "a4" })).toContain("margin: (inside: 30mm");
  });

  it("hyphenates Serbian Latin text with the Croatian rules", () => {
    expect(printTemplate(exportBook, { size: "a5" })).toContain('lang: "hr"');
    expect(typstLang("sr-Latn")).toBe("hr");
  });
});

describe("manuscriptTemplate", () => {
  it.each([
    { author: "Ana Petrović", contact: "ana@primer.rs\n+381 60 123 4567", spacing: 1.5 as const },
    { spacing: 2 as const },
  ])("compiles the whole book without errors (%o)", async (options) => {
    const run = await runTypst(manuscriptTemplate(exportBook, options), "footnote");
    expect(run.errors).toEqual([]);
    expect(run.query).toHaveLength(1);
  });

  it("starts every part on a new page, numbered from 1 after the title page", async () => {
    const probe = `
#context [#metadata((
  numbers: query(<part-start>).map(m => counter(page).at(m.location()).first()),
  physical: query(<part-start>).map(m => m.location().page()),
)) <probe>]`;
    // Mark each part start, so the test sees where it landed.
    const source = manuscriptTemplate(exportBook, { spacing: 1.5 })
      .replace("#let part(label: none, title: none, body) = {\n  pagebreak(weak: true)", "$&\n  [#metadata(none) <part-start>]")
      .replace("#let dedication(body) = {\n  pagebreak(weak: true)", "$&\n  [#metadata(none) <part-start>]");
    const run = await runTypst(source + probe, "<probe>", "value");
    expect(run.errors).toEqual([]);
    const { numbers, physical } = run.query?.[0] as { numbers: number[]; physical: number[] };
    // Posveta, chapter I, chapter III, Zahvalnica — each alone from the second physical page on.
    expect(physical).toHaveLength(4);
    expect(physical[0]).toBe(2);
    expect(new Set(physical).size).toBe(4);
    expect(numbers[0]).toBe(1);
  });

  it("indents every paragraph, left aligned, without hyphenation", () => {
    const source = manuscriptTemplate(exportBook, { spacing: 2 });
    expect(source).toContain("justify: false");
    expect(source).toContain("first-line-indent: (amount: 1.25cm, all: true)");
    expect(source).toContain("leading: 1.3em");
    expect(source).not.toContain(copy.export.contents);
  });

  it("names the kind of book under the title, and leaves out what is missing", () => {
    expect(manuscriptTemplate(exportBook, { spacing: 1.5 })).toContain("#v(1em) triler");
    const novel = buildBook({ ...book, genre: "literarni" }, []);
    expect(manuscriptTemplate(novel, { spacing: 1.5 })).toContain("#v(1em) roman");
    const other = manuscriptTemplate(buildBook({ ...book, genre: "drugo" }, []), { spacing: 1.5 });
    expect(other).not.toMatch(/#v\(1em\) (roman|drugo)/i);
    // No author, no contact: no empty line on the title page.
    expect(other).not.toContain("#v(1em) \n");
  });

  it("writes the running head and the word count on the title page", () => {
    const source = manuscriptTemplate(exportBook, { author: "Ana Petrović", spacing: 1.5 });
    expect(source).toContain("Petrović / KIŠA \\#1 \\\"NOĆU\\\" / #counter(page).display()");
    expect(source).toContain("oko 240\\.000 reči");
    expect(source).toContain("hyphenate: false");
  });
});

describe("common", () => {
  it("rounds the word count for the manuscript", () => {
    expect(copy.export.aboutWords(81_640)).toBe("oko 82.000 reči");
    expect(copy.export.aboutWords(430)).toBe("oko 400 reči");
    expect(copy.export.aboutWords(12)).toBe("oko 100 reči");
  });

  it("takes the surname and splits contact lines", () => {
    expect(surname(" Ana  Petrović ")).toBe("Petrović");
    expect(surname(undefined)).toBe("");
    expect(lines("ana@primer.rs\n\n+381 60")).toBe("ana\\@primer\\.rs #linebreak(); \\+381 60");
  });
});
