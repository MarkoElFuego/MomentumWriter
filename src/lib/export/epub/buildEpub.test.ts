import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { Packer } from "docx";
import type { JSONContent } from "@tiptap/react";
import type { Book, Part, PartKind } from "@/lib/db/schema";
import { kindleDocx } from "../docx/manuscriptDocx";
import { ebookFileName } from "../fileName";
import { buildBook } from "../typst/buildBook";
import { buildEpub } from "./buildEpub";

const t = (text: string, ...marks: string[]): JSONContent => ({ type: "text", text, ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}) });
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

const book: Book = { id: "6F1C2B9E-3A4D-4C5E-8F60-718293A4B5C6", title: "Kiša & <noć>", language: "sr-Latn", createdAt: 0, updatedAt: 0 };
let order = 0;
const part = (kind: PartKind, title: string, content: JSONContent): Part => ({
  id: `p${(order += 1)}`,
  bookId: book.id,
  kind,
  title,
  order,
  content,
  wordCount: 100,
  createdAt: 0,
  updatedAt: 0,
});
const note = (id: string, text: string): JSONContent => ({ type: "footnotes", content: [{ type: "footnote", attrs: { id }, content: [t(text, "italic")] }] });
const model = buildBook(book, [
  part("front", "Posveta", doc(p(t("Mami.")))),
  part("chapter", "Dolazak", doc(p(t("Prvo \"tiho\""), { type: "footnoteRef", attrs: { id: "a" } }, t(" <x>.")), { type: "sceneBreak" }, p(t("Posle.")), note("a", "Prva."))),
  part("chapter", "", doc(p(t("Drugo"), { type: "footnoteRef", attrs: { id: "b" } }, t(".")), note("b", "Druga."))),
  part("back", "Zahvalnica", doc(p(t("Hvala.")))),
]);
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const now = new Date("2026-10-09T12:34:56.789Z");

async function open(cover?: Uint8Array) {
  const zip = await JSZip.loadAsync(await buildEpub(model, { id: book.id, author: "Ana Petrović", cover, now }));
  return { zip, read: (name: string) => zip.file(name)!.async("string") };
}

describe("buildEpub", () => {
  it("starts with an uncompressed mimetype, then the container", async () => {
    const bytes = await buildEpub(model, { id: book.id, now });
    // A ZIP local header: name "mimetype" at byte 30, stored (method 0), content right after.
    const text = new TextDecoder().decode(bytes.slice(30, 38 + 20));
    expect(text).toBe("mimetypeapplication/epub+zip");
    expect(bytes[8]).toBe(0);
    const { zip } = await open();
    expect(Object.keys(zip.files)).toContain("META-INF/container.xml");
  });

  it("writes title, author, Serbian Latin, dates and the cover into the package", async () => {
    const opf = await (await open(PNG)).read("OEBPS/content.opf");
    expect(opf).toContain("<dc:title>Kiša &amp; &lt;noć&gt;</dc:title>");
    expect(opf).toContain("<dc:creator>Ana Petrović</dc:creator>");
    expect(opf).toContain("<dc:language>sr-Latn</dc:language>");
    expect(opf).toContain("urn:uuid:6f1c2b9e-3a4d-4c5e-8f60-718293a4b5c6");
    expect(opf).toContain('<meta property="dcterms:modified">2026-10-09T12:34:56Z</meta>');
    expect(opf).toContain('properties="cover-image"');
    // Reading order: cover, title page, then the parts.
    expect([...opf.matchAll(/<itemref idref="([^"]+)"/g)].map((m) => m[1])).toEqual(["cover", "titlepage", "part-1", "part-2", "part-3", "part-4"]);
  });

  it("leaves the cover out when there is no image", async () => {
    const { zip, read } = await open();
    expect(zip.file("OEBPS/cover.xhtml")).toBeNull();
    expect(await read("OEBPS/content.opf")).not.toContain("cover-image");
  });

  it("lists the parts in the table of contents, not the dedication", async () => {
    const nav = await (await open()).read("OEBPS/nav.xhtml");
    const entries = [...nav.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g)].map((m) => m[2]);
    expect(entries).toEqual(["Poglavlje I · Dolazak", "Poglavlje II", "Zahvalnica"]);
    expect(nav).toContain('epub:type="bodymatter" href="part-002.xhtml"');
  });

  it("makes EPUB 3 notes, numbered through the book, that link back", async () => {
    const { read } = await open();
    const first = await read("OEBPS/part-002.xhtml");
    expect(first).toContain('<a epub:type="noteref" href="#note-1" id="ref-1" class="noteref">1</a>');
    expect(first).toContain('<aside epub:type="footnote" id="note-1" class="footnote"><p><a href="#ref-1">1</a> <em>Prva.</em></p></aside>');
    expect(await read("OEBPS/part-003.xhtml")).toContain('id="note-2"');
  });

  it("escapes the text and keeps scene breaks and the dedication", async () => {
    const { read } = await open();
    const chapter = await read("OEBPS/part-002.xhtml");
    expect(chapter).toContain("Prvo &quot;tiho&quot;");
    expect(chapter).toContain(" &lt;x&gt;.");
    expect(chapter).toContain('<p class="scene-break" role="separator">* * *</p>');
    expect(chapter).toContain('<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="sr-Latn" lang="sr-Latn">');
    expect(await read("OEBPS/part-001.xhtml")).toContain('<section epub:type="dedication" class="dedication">');
  });

  it("leaves font and size to the reader", async () => {
    const css = await (await open()).read("OEBPS/style.css");
    expect(css).not.toMatch(/font-family|font-size:\s*\d+(px|pt)/);
    expect(css).toContain("text-indent: 1.2em");
  });
});

describe("kindleDocx", () => {
  it("is a book, not a manuscript: no header or page numbers, real footnotes kept", async () => {
    const zip = await JSZip.loadAsync(await Packer.toBuffer(kindleDocx(model, { author: "Ana Petrović" })));
    const document = await zip.file("word/document.xml")!.async("string");
    expect(document).not.toContain("headerReference");
    expect(document).not.toContain("pgNumType w:start");
    expect([...document.matchAll(/<w:footnoteReference w:id="(\d+)"\/>/g)].map((m) => m[1])).toEqual(["1", "2"]);
    expect(document).toContain("Kiša &amp; &lt;noć&gt;");
    expect(document).not.toContain("reči");
  });
});

describe("ebookFileName", () => {
  it("names the EPUB after the book, the Kindle Word file with a suffix", () => {
    expect(ebookFileName("Kiša nad stanicom", "epub")).toBe("Kiša-nad-stanicom.epub");
    expect(ebookFileName("Kiša", "docx")).toBe("Kiša-Kindle.docx");
  });
});
