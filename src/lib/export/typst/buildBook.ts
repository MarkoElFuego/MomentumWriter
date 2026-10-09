import type { JSONContent } from "@tiptap/react";
import { copy } from "@/lib/copy";
import { isAlive, sortParts } from "@/lib/db/parts";
import type { Book, Genre, PartKind, Part } from "@/lib/db/schema";
import type { Language } from "@/lib/languages";
import { partToTypst } from "./fromTiptap";

// The whole book, ready for a template (ZADATAK_IZVOZ P1): parts in book order,
// each already Typst markup. Parts without text are left out — a book has no
// empty pages — but chapters keep the numbers the author sees in the editor.

export interface ExportSection {
  id: string;
  kind: PartKind;
  /** „Naslovna” fills the title page; „Posveta” has no heading and sits alone on its page. */
  role: "titlePage" | "dedication" | "part";
  /** Chapters only: the number shown in the editor. */
  number?: number;
  /** Chapters: the optional name ("" = none). Front and back matter: the part's title. */
  title: string;
  /** Typst markup of the text. */
  body: string;
  /** The part's own document, for formats other than Typst (DOCX, P7). */
  content: JSONContent;
}

export interface ExportBook {
  title: string;
  language: Language;
  genre?: Genre;
  /** All live parts, as the editor counts them. */
  wordCount: number;
  sections: ExportSection[];
}

const [TITLE_PAGE, DEDICATION] = copy.structure.partPresets.front;
const isPreset = (part: Part, name: string | undefined) =>
  part.kind === "front" && part.title.trim().toLocaleLowerCase("sr") === name?.toLocaleLowerCase("sr");

/** True when the part has anything to print: text or a scene break (footnotes alone don't count). */
export function hasText(content: JSONContent): boolean {
  const visit = (node: JSONContent): boolean =>
    node.type !== "footnotes" &&
    ((node.type === "text" && (node.text ?? "").trim() !== "") ||
      node.type === "sceneBreak" ||
      (node.content ?? []).some(visit));
  return visit(content);
}

export function buildBook(book: Book, allParts: Part[]): ExportBook {
  const parts = sortParts(allParts.filter((part) => part.bookId === book.id && isAlive(part)));
  const sections: ExportSection[] = [];
  let chapter = 0;
  let titlePage = false;
  for (const part of parts) {
    // Counted before the empty check: numbers stay as in the editor.
    if (part.kind === "chapter") chapter++;
    if (!hasText(part.content)) continue;
    const role = isPreset(part, TITLE_PAGE) && !titlePage ? "titlePage" : isPreset(part, DEDICATION) ? "dedication" : "part";
    if (role === "titlePage") titlePage = true;
    sections.push({
      id: part.id,
      kind: part.kind,
      role,
      ...(part.kind === "chapter" ? { number: chapter } : {}),
      title: part.kind === "chapter" ? part.title.trim() : part.title.trim() || copy.structure.untitledPart,
      body: partToTypst(part.content),
      content: part.content,
    });
  }
  return {
    title: book.title.trim() || copy.structure.defaultBookTitle,
    language: book.language,
    genre: book.genre,
    wordCount: parts.reduce((sum, part) => sum + part.wordCount, 0),
    sections,
  };
}
