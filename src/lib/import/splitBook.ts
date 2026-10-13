import type { JSONContent } from "@tiptap/react";
import { tidyBlocks } from "@/components/editor/tidyText";
import { copy } from "@/lib/copy";
import type { PartKind } from "@/lib/db/schema";
import { countWords } from "@/lib/text/countWords";
import { firstSentence } from "@/lib/text/draftEnd";
import { headingRole, isSceneBreakText, styledHeadingRole, type HeadingRole } from "./chapterHeading";
import { blockText, docText, inlineText, mainText, PAGE_BREAK } from "./text";

// Uvoz (I1): one long run of blocks → the parts of a book. Only the layout
// changes: a chapter heading becomes the part (its number goes, its name
// stays), everything else is the author's text as it was.

/** Footnote id → the note's inline content (from fromHtml). */
export type FootnoteNotes = ReadonlyMap<string, JSONContent[]>;

export interface ImportedPart {
  kind: PartKind;
  title: string;
  /** A whole part document — footnote zone included. */
  content: JSONContent;
  words: number;
  firstSentence: string;
  /** The block the part was cut at; „Spoji sa prethodnim” puts it back into the text. */
  heading?: JSONContent;
}

/** A short text before the first part: the title, maybe the author. Not imported unless the author keeps it. */
export interface TitlePage {
  content: JSONContent;
  words: number;
  /** A suggestion for the book title — its first line. */
  title: string;
}

export interface SplitBook {
  parts: ImportedPart[];
  titlePage?: TitlePage;
  /** False: no parts were found — the whole text is one chapter. */
  recognized: boolean;
  /** Heading texts whose words may be missing from the book (the chapter numbers) — for wordAudit. */
  dropped: string[];
}

/** Text before the first part up to this length is a title page; longer is a front part. */
export const TITLE_PAGE_WORDS = 60;
/** A dedication is a line or two, alone on its page. */
const DEDICATION_WORDS = 40;

interface Boundary {
  index: number;
  kind: PartKind;
  title: string;
}

const isTextBlock = (block: JSONContent) => block.type === "paragraph" || block.type === "heading";
const level = (block: JSONContent) => (block.type === "heading" ? Number(block.attrs?.level ?? 1) : 0);

function toSceneBreak(block: JSONContent): JSONContent {
  if (block.type !== "paragraph" || !block.content?.length) return block;
  if (block.content.some((node) => node.type !== "text")) return block;
  return isSceneBreakText(inlineText(block.content)) ? { type: "sceneBreak" } : block;
}

function roleOf(block: JSONContent, styled: boolean): HeadingRole | null {
  if (!isTextBlock(block)) return null;
  const text = inlineText(block.content);
  return styled ? styledHeadingRole(text) : headingRole(text);
}

/** The chapter headings: styled headings first (the highest level that repeats), else a repeating pattern of short lines. */
function chapterHeadings(blocks: JSONContent[]): { indexes: number[]; styled: boolean; level: number } {
  for (const wanted of [1, 2, 3, 4, 5, 6]) {
    const indexes = blocks.flatMap((block, i) =>
      level(block) === wanted && roleOf(block, true)?.role !== "bookPart" ? [i] : [],
    );
    if (indexes.length >= 2) return { indexes, styled: true, level: wanted };
  }

  const families = new Map<string, number[]>();
  blocks.forEach((block, i) => {
    const role = roleOf(block, false);
    if (role?.role !== "chapter") return;
    families.set(role.family, [...(families.get(role.family) ?? []), i]);
  });
  // The most frequent repeating family; on a tie the one that comes first.
  let best: number[] = [];
  for (const indexes of families.values()) if (indexes.length >= 2 && indexes.length > best.length) best = indexes;
  return { indexes: best, styled: false, level: 0 };
}

/** Headings inside a part: the level right under the chapters is Naslov 1, anything deeper Naslov 2. */
function fitLevels(blocks: JSONContent[], chapterLevel: number): JSONContent[] {
  return blocks.map((block) => {
    if (block.type === "heading") return { ...block, attrs: { ...block.attrs, level: level(block) <= chapterLevel + 1 ? 1 : 2 } };
    return block.content && block.type === "blockquote" ? { ...block, content: fitLevels(block.content, chapterLevel) } : block;
  });
}

function boundaries(blocks: JSONContent[]): { bounds: Boundary[]; level: number } {
  const { indexes, styled, level: chapterLevel } = chapterHeadings(blocks);
  if (!indexes.length) return { bounds: [], level: 0 };
  const roles = new Map(indexes.map((i) => [i, roleOf(blocks[i]!, styled)!]));
  const chapters = indexes.filter((i) => roles.get(i)!.role === "chapter");
  // Only "Prolog" and "Epilog" styled as headings: no chapters around them, so they are chapters.
  const first = chapters[0] ?? Infinity;
  const last = chapters.at(-1) ?? -Infinity;
  const found = new Map<number, Boundary>();

  // Front matter only before the first chapter, back matter only after the last;
  // a styled "Prolog" in the middle of the book is a chapter called Prolog.
  for (const index of indexes) {
    const role = roles.get(index)!;
    const title = role.role === "bookPart" ? "" : role.title;
    const kind = role.role === "front" && index < first ? "front" : role.role === "back" && index > last ? "back" : "chapter";
    found.set(index, { index, kind, title });
  }
  blocks.forEach((block, index) => {
    if (found.has(index) || !isTextBlock(block)) return;
    const role = headingRole(inlineText(block.content));
    if (role?.role === "front" && index < first) found.set(index, { index, kind: "front", title: role.title });
    if (role?.role === "back" && index > last) found.set(index, { index, kind: "back", title: role.title });
  });
  return { bounds: [...found.values()].sort((a, b) => a.index - b.index), level: chapterLevel };
}

function footnoteIds(blocks: JSONContent[]): string[] {
  const ids: string[] = [];
  const walk = (nodes: JSONContent[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === "footnoteRef" && typeof node.attrs?.id === "string") ids.push(node.attrs.id);
      walk(node.content);
    }
  };
  walk(blocks);
  return ids;
}

/** Prose blocks + their footnotes in the zone at the end, like a part written in Momentum. */
function partDoc(blocks: JSONContent[], notes: FootnoteNotes): JSONContent {
  const body = blocks.length ? blocks : [{ type: "paragraph" }];
  const ids = footnoteIds(body);
  if (!ids.length) return { type: "doc", content: body };
  const zone: JSONContent = {
    type: "footnotes",
    content: ids.map((id) => {
      const note = notes.get(id);
      return note?.length ? { type: "footnote", attrs: { id }, content: note } : { type: "footnote", attrs: { id } };
    }),
  };
  return { type: "doc", content: [...body, zone] };
}

export function importedPart(kind: PartKind, title: string, content: JSONContent, heading?: JSONContent): ImportedPart {
  return {
    kind,
    title,
    content,
    words: countWords(docText(content)),
    firstSentence: firstSentence(mainText(content)),
    ...(heading ? { heading } : {}),
  };
}

function bodyOf(doc: JSONContent): JSONContent[] {
  return (doc.content ?? []).filter((block) => block.type !== "footnotes");
}

function notesOf(doc: JSONContent): Map<string, JSONContent[]> {
  const zone = doc.content?.find((block) => block.type === "footnotes");
  return new Map((zone?.content ?? []).map((note) => [String(note.attrs?.id), note.content ?? []]));
}

const asSubheading = (block: JSONContent): JSONContent => ({ type: "heading", attrs: { level: 1 }, content: block.content });
const isPageBreak = (block: JSONContent) => block.type === PAGE_BREAK;
const blocksWords = (blocks: JSONContent[]) => countWords(blocks.map((block) => blockText(block)).join("\n"));

/** Text the author set apart like a dedication: every line centered or all in italic. */
function looksSetApart(blocks: JSONContent[]): boolean {
  const lines = blocks.filter((block) => block.type === "paragraph" && inlineText(block.content).trim());
  const italic = (block: JSONContent) =>
    (block.content ?? []).every((node) => node.type !== "text" || !node.text?.trim() || node.marks?.some((mark) => mark.type === "italic"));
  return lines.length > 0 && blocks.every((block) => block.type === "paragraph") && lines.every((block) => block.attrs?.textAlign === "center" || italic(block));
}

/** The pages before the first part: a title page, a dedication alone on its page, or a front part. */
function frontPages(blocks: JSONContent[], clean: (blocks: JSONContent[]) => JSONContent[], notes: FootnoteNotes) {
  const pages: JSONContent[][] = [[]];
  for (const block of blocks) {
    if (isPageBreak(block)) pages.push([]);
    else pages.at(-1)!.push(block);
  }
  const written = pages.filter((page) => blocksWords(page) > 0);
  let dedication: ImportedPart | undefined;
  const last = written.at(-1);
  // Only after another page (a title page) — a short first page is the title page itself.
  if (written.length >= 2 && last && blocksWords(last) <= DEDICATION_WORDS && looksSetApart(last)) {
    written.pop();
    dedication = importedPart("front", copy.structure.partPresets.front[1], partDoc(clean(last), notes));
  }

  const before = clean(written.flat());
  const doc = partDoc(before, notes);
  const words = countWords(docText(doc));
  const front = words > TITLE_PAGE_WORDS ? importedPart("front", "", doc) : undefined;
  const firstLine = before.map((block) => inlineText(block.content).trim()).find(Boolean) ?? "";
  const titlePage = words > 0 && !front ? { content: doc, words, title: firstLine.slice(0, 120) } : undefined;
  return { front, dedication, titlePage };
}

export function splitBook(source: JSONContent[], notes: FootnoteNotes = new Map()): SplitBook {
  const blocks = source.map(toSceneBreak);
  const { bounds, level: chapterLevel } = boundaries(blocks);
  const clean = (part: JSONContent[]) => tidyBlocks(fitLevels(part.filter((block) => !isPageBreak(block)), chapterLevel));

  if (!bounds.length) {
    const content = partDoc(clean(blocks), notes);
    return { parts: [importedPart("chapter", "", content)], recognized: false, dropped: [] };
  }

  // „Deo prvi” moves to the start of the next chapter as a heading — Momentum has no level above chapters.
  const bookParts = new Set<number>();
  blocks.forEach((block, i) => {
    if (!isTextBlock(block) || bounds.some((b) => b.index === i)) return;
    const text = inlineText(block.content);
    if (headingRole(text)?.role === "bookPart" && bounds.some((b) => b.index > i && b.kind === "chapter")) bookParts.add(i);
  });

  const segment = (from: number, to: number) => blocks.slice(from, to).filter((_, i) => !bookParts.has(from + i));
  const dropped: string[] = [];
  const { front, dedication, titlePage } = frontPages(segment(0, bounds[0]!.index), clean, notes);
  const parts: ImportedPart[] = [front, dedication].filter((part): part is ImportedPart => Boolean(part));

  let pending: JSONContent[] = [];
  bounds.forEach((bound, n) => {
    const end = bounds[n + 1]?.index ?? blocks.length;
    const heading = blocks[bound.index]!;
    dropped.push(inlineText(heading.content));
    for (const i of bookParts) if (i < bound.index && i > (bounds[n - 1]?.index ?? -1)) pending.push(asSubheading(blocks[i]!));
    const lead = bound.kind === "chapter" ? pending : [];
    if (bound.kind === "chapter") pending = [];
    const content = partDoc(clean([...lead, ...segment(bound.index + 1, end)]), notes);
    // Put back by „Spoji sa prethodnim” as a heading inside the text.
    const kept = heading.type === "heading" ? { ...heading, attrs: { ...heading.attrs, level: 1 } } : heading;
    parts.push(importedPart(bound.kind, bound.title, content, kept));
  });

  return { parts, ...(titlePage ? { titlePage } : {}), recognized: true, dropped };
}

/** The title page kept as the part „Naslovna”. */
export function titlePagePart(page: TitlePage): ImportedPart {
  return importedPart("front", copy.structure.partPresets.front[0], page.content);
}

/** „Spoji sa prethodnim”: the part goes back into the one before it, with its heading as a line of text. */
export function mergeWithPrevious(parts: ImportedPart[], index: number): ImportedPart[] {
  const previous = parts[index - 1];
  const current = parts[index];
  if (!previous || !current) return parts;
  const blocks = [...bodyOf(previous.content), ...(current.heading ? [current.heading] : []), ...bodyOf(current.content)];
  const notes = new Map([...notesOf(previous.content), ...notesOf(current.content)]);
  const merged = importedPart(previous.kind, previous.title, partDoc(blocks, notes), previous.heading);
  return [...parts.slice(0, index - 1), merged, ...parts.slice(index + 1)];
}

