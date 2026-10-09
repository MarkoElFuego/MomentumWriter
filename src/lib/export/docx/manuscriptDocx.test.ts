import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { Packer } from "docx";
import type { JSONContent } from "@tiptap/react";
import type { Book, Part, PartKind } from "@/lib/db/schema";
import { buildBook } from "../typst/buildBook";
import { manuscriptDocx } from "./manuscriptDocx";

const t = (value: string, ...marks: string[]): JSONContent => ({
  type: "text",
  text: value,
  ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}),
});
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

const chapter = doc(
  p(t("Đorđe je čekao"), { type: "footnoteRef", attrs: { id: "a" } }, t(" na stanici <x> & \"y\". "), t("Tiho", "italic"), t(", "), t("jasno", "bold"), t(".")),
  { type: "heading", attrs: { level: 1 }, content: [t("Međunaslov")] },
  { type: "blockquote", content: [p(t("Citat."))] },
  { type: "sceneBreak" },
  { type: "paragraph", attrs: { textAlign: "center" }, content: [t("Centrirano")] },
  p(t("Red"), { type: "hardBreak" }, t("drugi")),
  p(t("   ")),
  { type: "footnotes", content: [{ type: "footnote", attrs: { id: "a" }, content: [t("Napomena sa "), t("kurzivom", "italic"), t(".")] }] },
);

const book: Book = { id: "b", title: "Kiša & noć", language: "sr-Latn", createdAt: 0, updatedAt: 0, genre: "literarni" };
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
const model = buildBook(book, [
  part("front", "Naslovna", doc(p(t("Ana Petrović")))),
  part("front", "Posveta", doc(p(t("Mami.")))),
  part("chapter", "Dolazak", chapter),
  part("chapter", "", doc(p(t("Drugo"), { type: "footnoteRef", attrs: { id: "b" } }, t(".")), { type: "footnotes", content: [{ type: "footnote", attrs: { id: "b" }, content: [t("Druga napomena.")] }] })),
  part("back", "Zahvalnica", doc(p(t("Hvala.")))),
]);

async function unzip(spacing: 1.5 | 2 = 1.5, author = "Ana Petrović") {
  const buffer = await Packer.toBuffer(manuscriptDocx(model, { author, contact: "ana@primer.rs\n+381 60", spacing }));
  const zip = await JSZip.loadAsync(buffer);
  const read = (name: string) => zip.file(name)!.async("string");
  return {
    document: await read("word/document.xml"),
    footnotes: await read("word/footnotes.xml"),
    styles: await read("word/styles.xml"),
    headers: await Promise.all(Object.keys(zip.files).filter((n) => /^word\/header\d*\.xml$/.test(n)).map(read)),
  };
}

/** Text of the document in order, paragraph by paragraph. */
function paragraphs(xml: string): { style?: string; text: string }[] {
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(([p]) => ({
    style: p.match(/<w:pStyle w:val="([^"]+)"/)?.[1],
    text: [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(""),
  }));
}

describe("manuscriptDocx", () => {
  it("makes real Word footnotes, numbered through the book, with their italics", async () => {
    const { document, footnotes } = await unzip();
    expect([...document.matchAll(/<w:footnoteReference w:id="(\d+)"\/>/g)].map((m) => m[1])).toEqual(["1", "2"]);
    expect(footnotes).toMatch(/<w:footnote w:id="1">[\s\S]*Napomena sa [\s\S]*<w:i\/>[\s\S]*kurzivom/);
    expect(footnotes).toContain("Druga napomena.");
    // Not as text at the end of the chapter.
    expect(document).not.toContain("Napomena sa");
  });

  it("uses Word styles in book order", async () => {
    const list = paragraphs((await unzip()).document).filter((p) => p.text);
    const texts = list.map((p) => p.text);
    expect(texts.indexOf("Mami.")).toBeLessThan(texts.indexOf("Poglavlje IDolazak"));
    expect(list.find((p) => p.text === "Poglavlje IDolazak")?.style).toBe("Heading1");
    expect(list.find((p) => p.text === "Poglavlje II")?.style).toBe("Heading1");
    expect(list.find((p) => p.text === "Zahvalnica")?.style).toBe("Heading1");
    expect(list.find((p) => p.text === "Međunaslov")?.style).toBe("Heading2");
    expect(list.find((p) => p.text === "Citat.")?.style).toBe("Quote");
    expect(list.find((p) => p.text === "#")?.style).toBe("SceneBreak");
    // Ordinary paragraphs carry no direct style: they are Normal.
    expect(list.find((p) => p.text.startsWith("Đorđe"))?.style).toBeUndefined();
    // A paragraph of spaces is no paragraph.
    expect(paragraphs((await unzip()).document).some((p) => p.text === "   ")).toBe(false);
  });

  it("keeps bold, italics, line breaks and centered lines", async () => {
    const { document } = await unzip();
    expect(document).toMatch(/<w:i\/>[\s\S]*?<w:t[^>]*>Tiho<\/w:t>/);
    expect(document).toMatch(/<w:b\/>[\s\S]*?<w:t[^>]*>jasno<\/w:t>/);
    expect(document).toMatch(/<w:t[^>]*>Red<\/w:t>[\s\S]*?<w:br\/>[\s\S]*?drugi/);
    expect(document).toMatch(/<w:jc w:val="center"\/>[\s\S]*?Centrirano/);
  });

  it("escapes what XML would read as markup", async () => {
    const { document } = await unzip();
    expect(document).toContain("na stanici &lt;x&gt; &amp; &quot;y&quot;.");
  });

  it("sets Normal: 12 pt, Serbian Latin, 1,5 or double, every first line indented", async () => {
    const oneHalf = (await unzip(1.5)).styles;
    expect(oneHalf).toContain('w:lang w:val="sr-Latn-RS"');
    expect(oneHalf).toMatch(/<w:style w:type="paragraph" w:styleId="Normal"[\s\S]*?w:firstLine="709"[\s\S]*?<\/w:style>/);
    expect(oneHalf).toMatch(/w:line="360"/);
    expect((await unzip(2)).styles).toMatch(/w:line="480"/);
  });

  it("puts the title page in its own section without header, then numbers from 1", async () => {
    const { document, headers } = await unzip();
    const sections = [...document.matchAll(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g)].map((m) => m[0]);
    expect(sections).toHaveLength(2);
    expect(sections[0]).not.toContain("headerReference");
    expect(sections[1]).toContain("headerReference");
    expect(sections[1]).toMatch(/<w:pgNumType w:start="1"/);
    const header = headers.join("");
    expect(header).toContain("Petrović / KIŠA &amp; NOĆ / ");
    expect(header).toContain("PAGE");
    // Title page: author and word count on the first line, the title, the kind of book.
    const first = paragraphs(document).filter((p) => p.text);
    expect(document).toMatch(/Ana Petrović<\/w:t><\/w:r><w:r><w:tab\/><w:t[^>]*>oko 200\.000 reči/);
    expect(first.map((p) => p.text)).toContain("KIŠA &amp; NOĆ");
    expect(first.map((p) => p.text)).toContain("roman");
  });
});
