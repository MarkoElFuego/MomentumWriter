import { getSchema, type JSONContent } from "@tiptap/react";
import { DOMParser as ProseMirrorParser, type Schema } from "@tiptap/pm/model";
import { contentExtensions } from "@/components/editor/contentSchema";
import { tidyBlocks } from "@/components/editor/tidyText";
import { newId } from "@/lib/db/id";
import { DEFAULT_LANGUAGE } from "@/lib/languages";
import type { FootnoteNotes } from "./splitBook";
import { inlineText, PAGE_BREAK } from "./text";

// Uvoz (I1): HTML — from a DOCX converter, or pasted from Word or Google Docs —
// → the blocks of a part, read by the editor's own schema, exactly like a paste
// into the editor. Footnotes become real footnotes when their link can be
// followed; anything not understood stays as plain text. Runs where a DOM
// exists (the browser; happy-dom in tests).

export interface HtmlImport {
  blocks: JSONContent[];
  notes: FootnoteNotes;
  /** The words of the source as it came in — for wordAudit. */
  sourceText: string;
  /** Footnote markers ("[1]") replaced by real footnotes — their "words" are gone on purpose. */
  dropped: string[];
  warnings: ImportWarnings;
}

export interface ImportWarnings {
  /** Momentum has no images; they are left out. */
  images: number;
  /** Turned into paragraphs, cell by cell. */
  tables: number;
  /** Footnote numbers whose note couldn't be found — kept as text. */
  plainFootnotes: number;
}

let schema: Schema | null = null;
const editorSchema = () => (schema ??= getSchema([...contentExtensions(DEFAULT_LANGUAGE)]));

const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "BR", "DD", "DIV", "DL", "DT", "FIGCAPTION", "FIGURE", "FOOTER",
  "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "OL", "P", "PRE", "SECTION", "TABLE", "TD", "TH", "TR", "UL",
]);
const SKIPPED_TAGS = new Set(["STYLE", "SCRIPT", "TITLE", "META", "LINK", "TEMPLATE", "NOSCRIPT"]);

// "[1]", "1", "(1)", "*", "†" — what a footnote number looks like in the text.
const MARKER = /^\s*(?:[[(]?\d{1,4}[\])]?|[*†‡]{1,3})\s*$/u;

/** Text with a line between blocks — `textContent` would glue "kraj.</p><p>Početak" into one word. */
export function domText(root: Node): string {
  let out = "";
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      out += node.nodeValue ?? "";
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = (node as Element).tagName.toUpperCase();
    if (SKIPPED_TAGS.has(tag)) return;
    // A footnote number sits right after a word ("kraj¹", Word: "kraj[1]"): keep it a word of its own.
    const apart = BLOCK_TAGS.has(tag) || tag === "SUP" || (tag === "A" && MARKER.test(node.textContent ?? ""));
    if (apart) out += "\n";
    node.childNodes.forEach(walk);
    if (apart) out += "\n";
  };
  walk(root);
  return out;
}

function byName(body: HTMLElement, name: string): Element | null {
  return [...body.querySelectorAll("a[name]")].find((a) => a.getAttribute("name") === name) ?? null;
}

function targetOf(body: HTMLElement, link: Element): Element | null {
  const href = link.getAttribute("href") ?? "";
  if (!href.startsWith("#") || href.length < 2) return null;
  let id = href.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    // Not encoded — use as it is.
  }
  return body.ownerDocument.getElementById(id) ?? byName(body, id);
}

/** The element holding the note: a list item (DOCX converters), else the paragraph with the back link (Word, Google Docs). */
function noteContainer(target: Element): Element {
  if (target.tagName === "A") return target.closest("li") ?? target.closest("p") ?? target.parentElement ?? target;
  return target;
}

const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & 4) !== 0;

/** Removes the node, then parents left with no text (the emptied note list). */
function removeWithEmptyParents(node: Element, body: HTMLElement) {
  let parent = node.parentElement;
  node.remove();
  while (parent && parent !== body && !parent.textContent?.trim()) {
    const next = parent.parentElement;
    parent.remove();
    parent = next;
  }
}

/** The note's text as one line — paragraphs of a note are joined with a space. */
function noteInline(container: Element, backLinks: Set<string>, parser: ProseMirrorParser): JSONContent[] {
  const clone = container.cloneNode(true) as Element;
  for (const link of [...clone.querySelectorAll("a")]) {
    const href = link.getAttribute("href") ?? "";
    const name = link.getAttribute("id") ?? link.getAttribute("name") ?? "";
    if (backLinks.has(href) || backLinks.has(`#${name}`) || (MARKER.test(link.textContent ?? "") && href.startsWith("#"))) link.remove();
  }
  const doc = clone.ownerDocument;
  const line = doc.createElement("p");
  const pieces = clone.tagName === "P" ? [clone] : [...clone.querySelectorAll("p")];
  for (const piece of pieces.length ? pieces : [clone]) {
    if (line.childNodes.length) line.append(doc.createTextNode(" "));
    line.append(...piece.childNodes);
  }
  const wrapper = doc.createElement("div");
  wrapper.append(line);
  const parsed = parser.parse(wrapper).toJSON() as JSONContent;
  const inline = (parsed.content?.[0]?.content ?? []).flatMap((node): JSONContent[] =>
    node.type === "text" ? [node] : node.type === "hardBreak" ? [{ type: "text", text: " " }] : [],
  );
  // "[1]&nbsp;Beleška" (Google Docs): the space after the removed number goes too.
  const first = inline[0];
  if (first?.text) first.text = first.text.replace(/^\s+/u, "");
  return tidyBlocks([{ type: "paragraph", content: inline.filter((node) => node.text) }])[0]?.content ?? [];
}

function convertFootnotes(body: HTMLElement, parser: ProseMirrorParser) {
  const notes = new Map<string, JSONContent[]>();
  const dropped: string[] = [];
  let plain = 0;

  for (const link of [...body.querySelectorAll("a[href^='#']")]) {
    if (!link.isConnected || !MARKER.test(link.textContent ?? "")) continue;
    const target = targetOf(body, link);
    const container = target && noteContainer(target);
    // A real note: somewhere after the number, not around it, not a heading (a table of contents).
    if (!container || container.contains(link) || !follows(link, container) || /^H\d$/u.test(container.tagName)) {
      plain++;
      continue;
    }
    const backLinks = new Set([link.getAttribute("id"), link.getAttribute("name")].filter(Boolean).map((id) => `#${id}`));
    const id = newId();
    notes.set(id, noteInline(container, backLinks, parser));
    dropped.push(link.textContent ?? "");
    if (target.tagName === "A") dropped.push(target.textContent ?? "");

    const ref = body.ownerDocument.createElement("sup");
    ref.setAttribute("data-footnote-ref", "");
    ref.setAttribute("data-id", id);
    const sup = link.parentElement?.tagName === "SUP" && link.parentElement.textContent?.trim() === link.textContent?.trim() ? link.parentElement : link;
    sup.replaceWith(ref);
    removeWithEmptyParents(container, body);
  }
  return { notes, dropped, plain };
}

function renameElement(element: Element, tag: string) {
  const renamed = element.ownerDocument.createElement(tag);
  for (const attribute of [...element.attributes]) renamed.setAttribute(attribute.name, attribute.value);
  renamed.append(...element.childNodes);
  element.replaceWith(renamed);
}

/** Cells become paragraphs, in reading order — the words stay, the grid goes. */
function flattenTable(table: Element) {
  const doc = table.ownerDocument;
  const out: Node[] = [];
  for (const cell of [...table.querySelectorAll("td, th")]) {
    if (!cell.textContent?.trim()) continue;
    const hasBlocks = [...cell.children].some((child) => BLOCK_TAGS.has(child.tagName.toUpperCase()) && child.tagName !== "BR");
    if (hasBlocks) {
      out.push(...cell.childNodes);
    } else {
      const p = doc.createElement("p");
      p.append(...cell.childNodes);
      out.push(p);
    }
  }
  table.replaceWith(...out);
}

/** Left and justified come from the source's page setup; only a centered line is the author's own layout. */
function keepCenterOnly(blocks: JSONContent[]): JSONContent[] {
  return blocks.map((block) => {
    const content = block.content && block.type !== "paragraph" && block.type !== "heading" ? keepCenterOnly(block.content) : block.content;
    if (!block.attrs || !("textAlign" in block.attrs) || block.attrs.textAlign === "center") return { ...block, content };
    return { ...block, attrs: { ...block.attrs, textAlign: "left" }, content };
  });
}

// A private-use character no author types: carries a page break through the parser.
const PAGE_BREAK_TEXT = "\uE000";

/** Headings in document order get the level they had in the source (1–6). */
function restoreLevels(blocks: JSONContent[], levels: number[]) {
  const headings: JSONContent[] = [];
  const walk = (nodes: JSONContent[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === "heading") headings.push(node);
      else walk(node.content);
    }
  };
  walk(blocks);
  // The parser dropped or added a heading somewhere: keep its two levels rather than guess.
  if (headings.length !== levels.length) return;
  headings.forEach((heading, i) => (heading.attrs = { ...heading.attrs, level: levels[i] }));
}

export function htmlToBlocks(html: string): HtmlImport {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;
  const sourceText = domText(body);
  const parser = ProseMirrorParser.fromSchema(editorSchema());

  for (const element of [...body.querySelectorAll("style, script, title, meta, link, template, noscript")]) element.remove();
  const images = body.querySelectorAll("img, svg, picture, video, canvas").length;
  for (const element of [...body.querySelectorAll("img, svg, picture, video, canvas")]) element.remove();

  const { notes, dropped, plain } = convertFootnotes(body, parser);

  const tables = [...body.querySelectorAll("table")];
  // Innermost first, so a nested table is already text when its parent goes.
  for (const table of tables.reverse()) flattenTable(table);
  // The schema has two heading levels; the source's own levels are put back after parsing,
  // so splitBook can tell the chapter level from the headings inside a chapter.
  const levels = [...body.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((heading) => Number(heading.tagName.slice(1)));
  for (const heading of [...body.querySelectorAll("h3, h4, h5, h6")]) renameElement(heading, "h2");
  for (const mark of [...body.querySelectorAll("hr[data-page-break]")]) {
    const line = doc.createElement("p");
    line.textContent = PAGE_BREAK_TEXT;
    mark.replaceWith(line);
  }

  const parsed = parser.parse(body).toJSON() as JSONContent;
  const blocks = keepCenterOnly((parsed.content ?? []).filter((block) => block.type !== "footnotes")).map((block) =>
    inlineText(block.content) === PAGE_BREAK_TEXT && block.type === "paragraph" ? { type: PAGE_BREAK } : block,
  );
  restoreLevels(blocks, levels);
  return { blocks, notes, sourceText, dropped, warnings: { images, tables: tables.length, plainFootnotes: plain } };
}
