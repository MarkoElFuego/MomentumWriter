import type { JSONContent } from "@tiptap/react";
import { countWords } from "@/lib/text/countWords";
import { blocksToLatin, cyrillicShare, toLatin } from "./cyrillic";
import { htmlToBlocks, type ImportWarnings } from "./fromHtml";
import { textToBlocks } from "./fromText";
import { splitBook, type FootnoteNotes, type SplitBook } from "./splitBook";

// Uvoz (I2): a file or a paste → one source the preview splits into parts.
// Everything stays in the browser; the DOCX and PDF readers load only when
// such a file is picked.

export type SourceKind = "docx" | "txt" | "pdf" | "paste";

export interface ImportSource {
  kind: SourceKind;
  blocks: JSONContent[];
  notes: FootnoteNotes;
  /** The words as they came in — wordAudit compares the book with it. */
  sourceText: string;
  dropped: string[];
  warnings: SourceWarnings;
  /** The title the document itself carries (DOCX properties) — the first suggestion for the book title. */
  title?: string;
  /** "Moja knjiga v3" — the last suggestion, after the title page. */
  fileName?: string;
  words: number;
}

export interface SourceWarnings extends ImportWarnings {
  /** More than half of the letters are Cyrillic: the preview offers „Preslovi na latinicu”. */
  cyrillic: boolean;
  /** PDF: footnotes can't be told apart from text there. */
  pdfFootnotes?: boolean;
}

export type ImportFailure = "encoding" | "unsupported" | "empty" | "scan";

/** A reason the preview can show; the details go to the console. */
export class ImportError extends Error {
  constructor(
    readonly reason: ImportFailure,
    message: string = reason,
  ) {
    super(message);
  }
}

export const ACCEPTED_FILES = ".docx,.txt,.pdf";

const NO_WARNINGS: ImportWarnings = { images: 0, tables: 0, plainFootnotes: 0 };

function source(kind: SourceKind, parts: Omit<ImportSource, "kind" | "words" | "warnings"> & { warnings?: Partial<SourceWarnings> }): ImportSource {
  const words = countWords(parts.sourceText);
  if (!words) throw new ImportError("empty");
  return {
    kind,
    ...parts,
    words,
    warnings: { ...NO_WARNINGS, cyrillic: cyrillicShare(parts.sourceText) > 0.5, ...parts.warnings },
  };
}

/**
 * Text files: UTF-8 (with or without BOM), UTF-16 with a BOM, else Windows-1250
 * — older Serbian files. Bytes that make no text (a NUL) mean it isn't text.
 */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1250").decode(bytes);
  }
  if (text.includes("\u0000")) throw new ImportError("encoding", "The file has NUL bytes — not a text file");
  return text.replace(/^﻿/u, "");
}

interface Names {
  title?: string;
  fileName?: string;
}

const names = ({ title, fileName }: Names = {}) => ({ ...(title ? { title } : {}), ...(fileName ? { fileName } : {}) });

function fromPlainText(kind: SourceKind, text: string, from?: Names): ImportSource {
  return source(kind, { blocks: textToBlocks(text), notes: new Map(), sourceText: text, dropped: [], ...names(from) });
}

function fromHtmlText(kind: SourceKind, html: string, from?: Names, warnings?: Partial<SourceWarnings>): ImportSource {
  const result = htmlToBlocks(html);
  return source(kind, { ...result, warnings: { ...result.warnings, ...warnings }, ...names(from) });
}

/** "Moja knjiga v3.docx" → "Moja knjiga v3". */
export const nameOf = (file: { name: string }) => file.name.replace(/\.[^.]+$/u, "").trim() || undefined;

export async function readFile(file: File): Promise<ImportSource> {
  const extension = file.name.toLowerCase().split(".").pop();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileName = nameOf(file);
  if (extension === "txt") return fromPlainText("txt", decodeText(bytes), { fileName });
  if (extension === "docx") {
    const { docxToHtml } = await import("./fromDocx");
    const { html, title } = await docxToHtml(bytes);
    return fromHtmlText("docx", html, { title, fileName });
  }
  if (extension === "pdf") {
    const { pdfToHtml } = await import("./fromPdf");
    const html = await pdfToHtml(bytes);
    return fromHtmlText("pdf", html, { fileName }, { pdfFootnotes: true });
  }
  throw new ImportError("unsupported", `Unsupported file: ${file.name}`);
}

/** A paste: the HTML version when the source gave one (Word, Google Docs), else the plain text. */
export function readPaste(html: string, text: string): ImportSource {
  if (html.trim()) {
    try {
      return fromHtmlText("paste", html);
    } catch (error) {
      // HTML without words (an image, an empty fragment): the plain text may still have them.
      if (!(error instanceof ImportError) || !text.trim()) throw error;
    }
  }
  return fromPlainText("paste", text);
}

/** The preview: Latin first if the author wants it, then the parts. */
export function prepare(source: ImportSource, latin: boolean): SplitBook & { sourceText: string } {
  if (!latin) return { ...splitBook(source.blocks, source.notes), sourceText: source.sourceText };
  const notes = new Map([...source.notes].map(([id, note]) => [id, blocksToLatin(note)]));
  const split = splitBook(blocksToLatin(source.blocks), notes);
  return { ...split, sourceText: toLatin(source.sourceText) };
}
