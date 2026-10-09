// P8 (ZADATAK_IZVOZ): checks an EPUB with the official epubcheck (Java).
//   pnpm check:epub              — builds a test book with every kind of node
//   pnpm check:epub book.epub    — checks a file exported from the app
// epubcheck lives in tools/ (not in git): https://github.com/w3c/epubcheck/releases
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { JSONContent } from "@tiptap/react";
import type { Book, Part, PartKind } from "../src/lib/db/schema";
import { buildEpub } from "../src/lib/export/epub/buildEpub";
import { buildBook } from "../src/lib/export/typst/buildBook";

const JAR = "tools/epubcheck-5.4.0/epubcheck.jar";
// 1×1 PNG: enough for the cover-image rules.
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));

const t = (text: string, ...marks: string[]): JSONContent => ({ type: "text", text, ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}) });
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

async function testBook(): Promise<string> {
  const book: Book = { id: "6f1c2b9e-3a4d-4c5e-8f60-718293a4b5c6", title: "Kiša & <noć>", language: "sr-Latn", createdAt: 0, updatedAt: 0 };
  let order = 0;
  const part = (kind: PartKind, title: string, content: JSONContent): Part => ({ id: `p${++order}`, bookId: book.id, kind, title, order, content, wordCount: 100, createdAt: 0, updatedAt: 0 });
  const model = buildBook(book, [
    part("front", "Posveta", doc(p(t("Mami.")))),
    part("front", "Predgovor", doc(p(t("Pre svega.")))),
    part("chapter", "Dolazak \"prvi\"", doc(
      p(t("Đorđe je čekao"), { type: "footnoteRef", attrs: { id: "a" } }, t(" na stanici. "), t("Tiho", "italic"), t(", "), t("jasno", "bold"), t(".")),
      { type: "heading", attrs: { level: 1 }, content: [t("Međunaslov")] },
      { type: "heading", attrs: { level: 2 }, content: [t("Manji")] },
      { type: "blockquote", content: [p(t("Citat."))] },
      { type: "sceneBreak" },
      { type: "paragraph", attrs: { textAlign: "center" }, content: [t("Centrirano")] },
      p(t("Red"), { type: "hardBreak" }, t("drugi")),
      { type: "bulletList", content: [{ type: "listItem", content: [p(t("stavka"))] }] },
      { type: "footnotes", content: [{ type: "footnote", attrs: { id: "a" }, content: [t("Napomena sa "), t("kurzivom", "italic"), t(".")] }] },
    )),
    part("chapter", "", doc(p(t("Drugo poglavlje.")))),
    part("back", "Zahvalnica", doc(p(t("Hvala.")))),
  ]);
  const epub = await buildEpub(model, { id: book.id, author: "Ana Petrović", cover: PNG, now: new Date() });
  mkdirSync("tools/out", { recursive: true });
  const file = join("tools", "out", "test.epub");
  writeFileSync(file, epub);
  return file;
}

async function main() {
  if (!existsSync(JAR)) {
    console.error(`Nema ${JAR} — preuzmi epubcheck 5.4.0 sa https://github.com/w3c/epubcheck/releases i raspakuj u tools/.`);
    process.exit(1);
  }
  const file = process.argv[2] ?? (await testBook());
  try {
    console.log(execFileSync("java", ["-jar", JAR, file], { encoding: "utf8" }));
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    console.error(e.stdout ?? "", e.stderr ?? "");
    process.exit(1);
  }
}

void main();
