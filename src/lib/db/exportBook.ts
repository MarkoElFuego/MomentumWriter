import { copy } from "@/lib/copy";
import { getLanguage, type Language } from "@/lib/languages";
import { partToMarkdown } from "@/lib/text/toMarkdown";
import { hasPrintableText, partToPrintHtml } from "@/lib/text/toPrintHtml";
import { getBook } from "./books";
import { chapterNumber, listParts, partHeading } from "./parts";
import type { ID, Part } from "./schema";

/**
 * The whole book as one Markdown file: title, then every part in book order.
 * Footnotes are numbered through the whole book so each reference is unique.
 */
export async function bookToMarkdown(bookId: ID): Promise<{ title: string; markdown: string } | undefined> {
  const book = await getBook(bookId);
  if (!book) return undefined;
  const parts = await listParts(bookId);

  const sections = [`# ${book.title}`];
  let nextNote = 1;
  for (const part of parts) {
    const { body, notes } = partToMarkdown(part.content, nextNote);
    const section = [`## ${partHeading(part, chapterNumber(parts, part.id))}`];
    if (body) section.push(body);
    if (notes.length) section.push(notes.map((note, i) => `[^${nextNote + i}]: ${note}`).join("\n"));
    nextNote += notes.length;
    sections.push(section.join("\n\n"));
  }
  return { title: book.title, markdown: sections.join("\n\n") + "\n" };
}

export interface PrintSection {
  id: ID;
  /** A dedication has no heading and sits alone on its page. */
  role: "dedication" | "part";
  /** "Poglavlje IV" above a chapter's name; undefined for front/back matter. */
  label?: string;
  /** Chapter name or the front/back part's title; "" = a chapter without a name. */
  title: string;
  body: string;
  /** Footnote HTML; the first one is number `firstNote`. */
  notes: string[];
  firstNote: number;
}

export interface PrintBook {
  title: string;
  language: Language;
  /** Text of the „Naslovna” part (author, subtitle…) under the title; "" when there is none. */
  titlePage: string;
  sections: PrintSection[];
}

const [TITLE_PAGE, DEDICATION] = copy.structure.partPresets.front;
const isPreset = (part: Part, name: string | undefined) =>
  part.kind === "front" && part.title.trim().toLocaleLowerCase("sr") === name?.toLocaleLowerCase("sr");

/**
 * The whole book laid out for print (PDF): a title page, then every part with
 * text in book order. Parts without text are left out — a book has no empty
 * pages — but chapters keep the numbers the author sees in the editor.
 */
export async function bookToPrint(bookId: ID): Promise<PrintBook | undefined> {
  const book = await getBook(bookId);
  if (!book) return undefined;
  const parts = await listParts(bookId);
  const sceneBreak = getLanguage(book.language).typography.sceneBreak;

  let titlePage = "";
  const sections: PrintSection[] = [];
  let nextNote = 1;
  for (const part of parts) {
    if (!hasPrintableText(part.content)) continue;
    if (isPreset(part, TITLE_PAGE) && !titlePage) {
      titlePage = partToPrintHtml(part.content, sceneBreak).body;
      continue;
    }
    const { body, notes } = partToPrintHtml(part.content, sceneBreak, nextNote);
    const number = chapterNumber(parts, part.id);
    sections.push({
      id: part.id,
      role: isPreset(part, DEDICATION) ? "dedication" : "part",
      label: part.kind === "chapter" && number ? copy.print.chapter(number) : undefined,
      title: part.kind === "chapter" ? part.title : part.title || copy.structure.untitledPart,
      body,
      notes,
      firstNote: nextNote,
    });
    nextNote += notes.length;
  }
  return { title: book.title, language: book.language, titlePage, sections };
}
