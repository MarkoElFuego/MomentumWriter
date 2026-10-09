import type { JSONContent } from "@tiptap/react";
import {
  AlignmentType,
  Document,
  FootnoteReferenceRun,
  Header,
  LineRuleType,
  PageNumber,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
  type IParagraphOptions,
} from "docx";
import { copy } from "@/lib/copy";
import type { ExportBook, ExportSection } from "../typst/buildBook";
import { sectionLabel, surname } from "../typst/templates/common";
import type { ManuscriptOptions } from "../typst/templates/manuscript.typ";

// „Rukopis za izdavača” as a Word file (ZADATAK_IZVOZ P7): the same layout as the
// PDF manuscript (P3), built from Word styles — Normal, Heading 1–3, Quote — so an
// editor can restyle it in one place. Footnotes are real Word footnotes.
// Imported lazily by the export dialog: the library stays out of the editor.

const LANGUAGE = "sr-Latn-RS";
/** Twips: 1 cm = 567. */
const CM = 567;
/** A4 minus 2.5 cm on each side: where the right tab stop on the title page goes. */
const TEXT_WIDTH = Math.round(16 * CM);
/** Word's 1,5 and double spacing (240 = single). */
const LINE = { 1.5: 360, 2: 480 } as const;

const STYLE = {
  normal: "Normal",
  heading1: "Heading1",
  heading2: "Heading2",
  heading3: "Heading3",
  quote: "Quote",
  sceneBreak: "SceneBreak",
} as const;

export function manuscriptDocx(book: ExportBook, options: ManuscriptOptions): Document {
  const author = options.author?.trim() ?? "";
  const notes = new Footnotes();
  const parts = book.sections.filter((s) => s.role !== "titlePage");

  const body: Paragraph[] = [];
  parts.forEach((section, index) => body.push(...sectionParagraphs(section, notes, index > 0)));

  const runningHead = [surname(author), book.title.toLocaleUpperCase("sr")].filter(Boolean).join(" / ");

  return new Document({
    title: book.title,
    creator: author || undefined,
    styles: styles(LINE[options.spacing]),
    footnotes: notes.all(),
    sections: [
      // The title page: no header, no page number.
      { properties: { page: pageSetup() }, children: titlePage(book, author, options.contact) },
      {
        properties: { page: { ...pageSetup(), pageNumbers: { start: 1 } } },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                indent: { firstLine: 0 },
                children: [new TextRun({ text: `${runningHead} / `, size: 20 }), new TextRun({ children: [PageNumber.CURRENT], size: 20 })],
              }),
            ],
          }),
        },
        children: body.length ? body : [new Paragraph({})],
      },
    ],
  });
}

/**
 * „DOCX za Kindle” (P8): the same styles and real footnotes, but a book, not a
 * manuscript — no header, no page numbers (the reader flows the text), single
 * spacing, and a plain title page with the title and the author.
 */
export function kindleDocx(book: ExportBook, options: { author?: string }): Document {
  const author = options.author?.trim() ?? "";
  const notes = new Footnotes();
  const parts = book.sections.filter((s) => s.role !== "titlePage");
  const flush = { indent: { firstLine: 0 }, alignment: AlignmentType.CENTER };
  const children: Paragraph[] = [
    new Paragraph({ ...flush, spacing: { before: Math.round(5 * CM) }, children: [new TextRun({ text: book.title, size: 40 })] }),
    ...(author ? [new Paragraph({ ...flush, spacing: { before: 480 }, children: [new TextRun(author)] })] : []),
  ];
  // Every part on a new page, the first one too: the title page comes before it.
  parts.forEach((section) => children.push(...sectionParagraphs(section, notes, true)));
  return new Document({
    title: book.title,
    creator: author || undefined,
    styles: styles(240),
    footnotes: notes.all(),
    sections: [{ properties: { page: pageSetup() }, children }],
  });
}

function pageSetup() {
  const margin = Math.round(2.5 * CM);
  return {
    size: { width: Math.round(21 * CM), height: Math.round(29.7 * CM) },
    margin: { top: margin, bottom: margin, left: margin, right: margin, header: Math.round(1.25 * CM), footer: Math.round(1.25 * CM) },
  };
}

function styles(line: number) {
  const run = { font: "Times New Roman", size: 24, language: { value: LANGUAGE } };
  const flush = { indent: { firstLine: 0 } };
  return {
    default: {
      document: { run, paragraph: { spacing: { line, lineRule: LineRuleType.AUTO, before: 0, after: 0 } } },
      // Chapter heading: about a third down a new page, "Poglavlje IV" over the title.
      heading1: {
        run: { ...run, bold: false, color: "000000" },
        paragraph: { ...flush, alignment: AlignmentType.CENTER, spacing: { before: Math.round(6 * CM), after: 2 * line, line }, keepNext: true },
      },
      heading2: {
        run: { ...run, bold: true, color: "000000" },
        paragraph: { ...flush, spacing: { before: 2 * line, after: line, line }, keepNext: true },
      },
      heading3: {
        run: { ...run, italics: true, bold: false, color: "000000" },
        paragraph: { ...flush, spacing: { before: line, after: 0, line }, keepNext: true },
      },
      footnoteText: { run: { ...run, size: 20 }, paragraph: { ...flush, spacing: { line: 240 } } },
    },
    paragraphStyles: [
      {
        id: STYLE.normal,
        name: "Normal",
        run,
        // A manuscript indents every paragraph, the first after a heading too.
        paragraph: { indent: { firstLine: Math.round(1.25 * CM) }, spacing: { line, lineRule: LineRuleType.AUTO } },
      },
      {
        id: STYLE.quote,
        name: "Quote",
        basedOn: STYLE.normal,
        next: STYLE.normal,
        run,
        paragraph: { indent: { left: Math.round(1.25 * CM), firstLine: 0 }, spacing: { before: line, after: line } },
      },
      {
        id: STYLE.sceneBreak,
        name: "Scene Break",
        basedOn: STYLE.normal,
        next: STYLE.normal,
        run,
        paragraph: { ...flush, alignment: AlignmentType.CENTER, spacing: { before: line, after: line } },
      },
    ],
  };
}

function titlePage(book: ExportBook, author: string, contact: string | undefined): Paragraph[] {
  const flush = { indent: { firstLine: 0 } };
  const contactLines = (contact ?? "")
    .split(/\r\n?|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const top = [author, ...contactLines];
  const words = copy.export.aboutWords(book.wordCount);
  const genre = book.genre ? copy.export.manuscriptGenre[book.genre] : undefined;
  return [
    // Top left the author and contact, top right the word count.
    new Paragraph({
      ...flush,
      tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH }],
      children: [new TextRun(top[0] ?? ""), new TextRun({ children: [new Tab(), words] })],
    }),
    ...top.slice(1).map((line) => new Paragraph({ ...flush, children: [new TextRun(line)] })),
    new Paragraph({
      ...flush,
      alignment: AlignmentType.CENTER,
      spacing: { before: Math.round(8 * CM) },
      children: [new TextRun({ text: book.title.toLocaleUpperCase("sr"), size: 32 })],
    }),
    ...[genre, author]
      .filter((line): line is string => Boolean(line))
      .map((line) => new Paragraph({ ...flush, alignment: AlignmentType.CENTER, spacing: { before: 240 }, children: [new TextRun(line)] })),
  ];
}

function sectionParagraphs(section: ExportSection, notes: Footnotes, newPage: boolean): Paragraph[] {
  const footnotes = collectFootnotes(section.content);
  const content = (section.content.content ?? []).filter((block) => block.type !== "footnotes");
  if (section.role === "dedication") {
    return content.map(
      (block, i) =>
        new Paragraph({
          alignment: AlignmentType.CENTER,
          indent: { firstLine: 0 },
          pageBreakBefore: i === 0 && newPage,
          spacing: i === 0 ? { before: Math.round(7 * CM) } : undefined,
          children: runs(block.content ?? [], notes, footnotes, { italics: true }),
        }),
    );
  }
  const label = sectionLabel(section);
  const heading = new Paragraph({
    style: STYLE.heading1,
    pageBreakBefore: newPage,
    children: [
      ...(label ? [new TextRun(label)] : []),
      ...(label && section.title ? [new TextRun({ text: section.title, break: 1 })] : section.title ? [new TextRun(section.title)] : []),
    ],
  });
  return [heading, ...blocks(content, notes, footnotes)];
}

type FootnoteMap = Map<string, JSONContent[]>;

function collectFootnotes(content: JSONContent): FootnoteMap {
  const map: FootnoteMap = new Map();
  for (const block of content.content ?? []) {
    if (block.type !== "footnotes") continue;
    for (const note of block.content ?? []) map.set(String(note.attrs?.id), note.content ?? []);
  }
  return map;
}

function blocks(nodes: JSONContent[], notes: Footnotes, footnotes: FootnoteMap, extra: IParagraphOptions = {}): Paragraph[] {
  return nodes.flatMap((node) => block(node, notes, footnotes, extra));
}

function block(node: JSONContent, notes: Footnotes, footnotes: FootnoteMap, extra: IParagraphOptions): Paragraph[] {
  switch (node.type) {
    case "paragraph": {
      const children = runs(node.content ?? [], notes, footnotes);
      if (!children.length) return [];
      const centered = node.attrs?.textAlign === "center";
      return [
        new Paragraph({
          ...extra,
          ...(centered ? { alignment: AlignmentType.CENTER, indent: { firstLine: 0 } } : {}),
          children,
        }),
      ];
    }
    case "heading": {
      const children = runs(node.content ?? [], notes, footnotes);
      if (!children.length) return [];
      return [new Paragraph({ style: node.attrs?.level === 2 ? STYLE.heading3 : STYLE.heading2, children })];
    }
    case "blockquote":
      return blocks(node.content ?? [], notes, footnotes, { style: STYLE.quote });
    case "sceneBreak":
      return [new Paragraph({ style: STYLE.sceneBreak, children: [new TextRun("#")] })];
    default:
      // Lists and anything unknown keep their text as plain paragraphs.
      return node.content ? blocks(node.content, notes, footnotes, extra) : [];
  }
}

function runs(nodes: JSONContent[], notes: Footnotes, footnotes: FootnoteMap, base: { italics?: boolean } = {}): (TextRun | FootnoteReferenceRun)[] {
  const out: (TextRun | FootnoteReferenceRun)[] = [];
  for (const node of nodes) {
    if (node.type === "text" && node.text) {
      const marks = node.marks?.map((m) => m.type) ?? [];
      out.push(new TextRun({ text: node.text, bold: marks.includes("bold") || undefined, italics: base.italics || marks.includes("italic") || undefined }));
    } else if (node.type === "hardBreak") {
      out.push(new TextRun({ break: 1 }));
    } else if (node.type === "footnoteRef") {
      const text = footnotes.get(String(node.attrs?.id)) ?? [];
      out.push(new FootnoteReferenceRun(notes.add(new Paragraph({ style: "FootnoteText", children: runs(text, notes, footnotes) }))));
    }
  }
  // Nothing but spaces is an empty paragraph.
  return nodes.some((n) => n.type === "footnoteRef" || (n.text ?? "").trim()) ? out : [];
}

/** Word footnotes, numbered through the whole book. */
class Footnotes {
  private notes: Record<string, { children: Paragraph[] }> = {};
  private next = 1;

  add(paragraph: Paragraph): number {
    const id = this.next++;
    this.notes[id] = { children: [paragraph] };
    return id;
  }

  all() {
    return this.notes;
  }
}
