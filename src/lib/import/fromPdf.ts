import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { PAGE_BREAK_HTML } from "./text";
import { ImportError } from "./read";

// Uvoz (I4): a PDF with text (not a scan) → HTML in the shape fromHtml reads.
// A PDF has no paragraphs, only lines placed on pages, so the layout is read
// back from positions: a paragraph starts at an indent or a gap, a part starts
// low on a fresh page or in bigger type, page numbers and running heads go
// (pravilo 1 — they were never the author's words). Italic and bold come from
// the font names. Footnotes stay text, under the paragraph where their page ended.
// pdf.js parses in its own Web Worker (public/pdfjs/, copied there before dev/build).

interface Run {
  text: string;
  italic: boolean;
  bold: boolean;
}

export interface PdfLine {
  page: number;
  /** Baseline from the top of the page. */
  top: number;
  left: number;
  right: number;
  /** The type size most of the line is set in. */
  size: number;
  runs: Run[];
  /** Begins with a footnote number ("[1] Svetonije…"). */
  noteStart?: boolean;
}

export interface PdfPage {
  number: number;
  width: number;
  height: number;
  lines: PdfLine[];
}

interface Item {
  text: string;
  x: number;
  top: number;
  width: number;
  size: number;
  font: string;
  /** A hyphen was drawn after it but left out of the text (Typst does that so copied words stay whole). */
  hyphen?: boolean;
}

const lineText = (line: PdfLine) => line.runs.map((run) => run.text).join("");
const wordCount = (text: string) => text.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

/** The value that occurs most (rounded), for sizes and margins. */
function mode(values: number[], step = 0.5): number | undefined {
  const counts = new Map<number, number>();
  for (const value of values) {
    const key = Math.round(value / step) * step;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: number | undefined;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== undefined && key < best)) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

/**
 * "P O G L AV L J E I I": pdf.js reads letter-spaced type (small caps, running
 * heads) as single letters. Joined back; a chapter label gets its space again.
 */
export function unspace(text: string): string {
  const tokens = text.trim().split(/\s+/u);
  if (tokens.length < 4 || tokens.filter((token) => [...token].length <= 2).length < tokens.length * 0.8) return text;
  const joined = tokens.join("");
  const label = /^(poglavlje|glava|chapter|deo)([ivxlcdm]+|\d+)$/iu.exec(joined);
  return label ? `${label[1]} ${label[2]}` : joined;
}

async function fontNames(page: PDFPageProxy, ids: Set<string>, names: Map<string, string>) {
  const missing = [...ids].filter((id) => !names.has(id));
  if (!missing.length) return;
  // Fonts reach the main thread with the page's drawing instructions.
  if (missing.some((id) => !page.commonObjs.has(id))) await page.getOperatorList();
  for (const id of missing) {
    const font = page.commonObjs.has(id) ? (page.commonObjs.get(id) as { name?: string }) : undefined;
    names.set(id, font?.name ?? "");
  }
}

export async function readPdfPages(pdf: PDFDocumentProxy): Promise<PdfPage[]> {
  const pages: PdfPage[] = [];
  const names = new Map<string, string>();
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const { width, height } = page.getViewport({ scale: 1 });
    const content = await page.getTextContent({ includeMarkedContent: true });
    const items: Item[] = [];
    // A marked span with no text right after a word: the hyphen of a word split at the line end.
    // Confirmed only when the word goes on in lower case on the next line.
    const spans: boolean[] = [];
    let hyphen: Item | undefined;
    for (const raw of content.items) {
      if (!("str" in raw)) {
        if (raw.type === "endMarkedContent") {
          const hadText = spans.pop();
          const last = items.at(-1);
          if (hadText === false && last && /\p{L}$/u.test(last.text)) hyphen = last;
        } else {
          spans.push(false);
        }
        continue;
      }
      if (!raw.str) continue;
      if (spans.length) spans[spans.length - 1] = true;
      if (hyphen && raw.str.trim()) {
        if (/^\p{Ll}/u.test(raw.str)) hyphen.hyphen = true;
        hyphen = undefined;
      }
      const [a, b, c, d, x, y] = raw.transform as number[];
      items.push({ text: raw.str, x: x!, top: height - y!, width: raw.width, size: Math.hypot(c!, d!) || Math.hypot(a!, b!), font: raw.fontName });
    }
    await fontNames(page, new Set(items.map((item) => item.font)), names);
    pages.push({ number, width, height, lines: toLines(items, names, number) });
    page.cleanup();
  }
  return pages;
}

function toLines(items: Item[], names: Map<string, string>, page: number): PdfLine[] {
  const sorted = [...items].sort((a, b) => a.top - b.top || a.x - b.x);
  const groups: Item[][] = [];
  for (const item of sorted) {
    const group = groups.at(-1);
    // A superscript sits a little higher: still the same line.
    if (group && Math.abs(item.top - group[0]!.top) < 0.6 * Math.max(item.size, group[0]!.size)) group.push(item);
    else groups.push([item]);
  }
  return groups.map((group) => {
    const ordered = group.sort((a, b) => a.x - b.x);
    const size = mode(ordered.flatMap((item) => Array<number>(item.text.length).fill(item.size)))!;
    // The line's baseline: the lowest item — a superscript sits above it.
    const baseline = Math.max(...ordered.map((item) => item.top));
    // A footnote number: a small or raised number (Word, LibreOffice), or a narrow
    // superscript figure of the same size (Typst sets it with the font's own superscripts).
    const footnoteNumber = (item: Item) =>
      /^\d{1,3}$/u.test(item.text) &&
      (baseline - item.top > 0.15 * size || item.size < 0.8 * size || item.width / item.text.length < 0.45 * item.size);
    const runs: Run[] = [];
    let noteStart = false;
    let previous: Item | undefined;
    for (const [i, item] of ordered.entries()) {
      const name = names.get(item.font) ?? "";
      let text = item.text;
      const gap = previous ? item.x - (previous.x + previous.width) : 0;
      if (previous && footnoteNumber(item) && gap < 0.15 * size && /[\p{L}.,;:!?…”"’)]$/u.test(previous.text)) {
        // Right after a word: the mark in the text — kept apart, "čekao [1]", and linked to its note later.
        text = ` [${text}]`;
      } else if (!previous && i + 1 < ordered.length && footnoteNumber(item) && item.size <= ordered[i + 1]!.size) {
        // At the start of a line, before its text: the number of a footnote at the foot of the page.
        text = `[${text}] `;
        noteStart = true;
      } else if (previous && gap > 0.15 * size && !/\s$/u.test(previous.text) && !/^\s/u.test(text)) {
        text = ` ${text}`;
      }
      runs.push({ text, italic: /italic|oblique/iu.test(name), bold: /bold|black|heavy/iu.test(name) });
      previous = item;
    }
    // Shown again, so „Sredi tekst” joins "miri-" and "salo" into one word.
    if (ordered.at(-1)!.hyphen) runs.at(-1)!.text += "-";
    const first = ordered[0]!;
    const last = ordered.at(-1)!;
    return { page, top: baseline, left: first.x, right: last.x + last.width, size, runs, ...(noteStart ? { noteStart } : {}) };
  });
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function runsHtml(runs: Run[]): string {
  let html = "";
  for (const run of runs) {
    let text = escapeHtml(run.text);
    if (run.italic) text = `<em>${text}</em>`;
    if (run.bold) text = `<strong>${text}</strong>`;
    html += text;
  }
  // Neighbouring runs in the same style: one tag.
  return html.replace(/<\/em><em>/gu, "").replace(/<\/strong><strong>/gu, "");
}

/** Repeated text on top or at the bottom of many pages, numbers aside: a running head or foot. */
const pattern = (text: string) => text.replace(/\d+/gu, "#").replace(/\s+/gu, " ").trim().toLowerCase();
const isPageNumber = (text: string) => /^(\d{1,4}|[ivxlcdm]{1,7})$/iu.test(text.trim());

interface Layout {
  body: number;
  pitch: number;
  /** Where the text area starts on a page that is all text. */
  textTop: number;
  left: [number, number];
  right: [number, number];
}

const bodySize = (pages: PdfPage[]) =>
  mode(pages.flatMap((page) => page.lines).flatMap((line) => Array<number>(lineText(line).length).fill(line.size)))!;

/** Text size, line spacing and the text area, from the pages without their running heads and numbers. */
function measure(pages: PdfPage[], skip: Set<PdfLine>): Layout {
  const body = bodySize(pages);
  const isBody = (line: PdfLine) => Math.abs(line.size - body) < 0.1 * body && !skip.has(line);
  const steps: number[] = [];
  for (const page of pages) {
    const tops = page.lines.filter(isBody).map((line) => line.top);
    for (let i = 1; i < tops.length; i++) if (tops[i]! - tops[i - 1]! < 3 * body) steps.push(tops[i]! - tops[i - 1]!);
  }
  const pitch = mode(steps, 0.25) ?? body * 1.3;
  const firstTops = pages.map((page) => page.lines.find(isBody)?.top).filter((top): top is number => top !== undefined);
  const textTop = mode(firstTops, 1) ?? 0;
  // The left edge: the leftmost line on pages of that side (the title page aside) — paragraphs
  // may all be indented, but wrapped lines, footnotes and flush headings reach the margin.
  const inner = pages.filter((page) => page.number > 1);
  const edge = (parity: number, pick: (line: PdfLine) => number, best: (...n: number[]) => number) => {
    const values = inner.filter((page) => page.number % 2 === parity).flatMap((page) => page.lines.filter((line) => !skip.has(line)).map(pick));
    return values.length ? best(...values) : 0;
  };
  return {
    body,
    pitch,
    textTop,
    left: [edge(0, (line) => line.left, Math.min), edge(1, (line) => line.left, Math.min)],
    right: [edge(0, (line) => line.right, Math.max), edge(1, (line) => line.right, Math.max)],
  };
}

/** Running heads, page numbers: on the edge of a page, numbers only or repeated on many pages. */
function furniture(pages: PdfPage[], body: number): Set<PdfLine> {
  const out = new Set<PdfLine>();
  const edges = pages.flatMap((page) => [...page.lines.slice(0, 2), ...page.lines.slice(-2)]);
  const counts = new Map<string, Set<number>>();
  for (const line of edges) counts.set(pattern(lineText(line)), (counts.get(pattern(lineText(line))) ?? new Set()).add(line.page));
  const repeated = (line: PdfLine) => (counts.get(pattern(lineText(line)))?.size ?? 0) >= Math.max(2, pages.length * 0.3);
  for (const page of pages) {
    const first = page.lines[0];
    const last = page.lines.at(-1);
    for (const line of [first, last]) {
      // The book title on the title page repeats as a running head — but there it's the title.
      if (line && (isPageNumber(lineText(line)) || (repeated(line) && page.number > 1))) out.add(line);
    }
  }
  // The book title repeats on every other page; where it stands is the running-head zone,
  // and a part's name there (in the same small type) is a running head too.
  const heads = pages.map((page) => page.lines[0]).filter((line): line is PdfLine => Boolean(line && out.has(line) && !isPageNumber(lineText(line))));
  if (heads.length) {
    const zone = Math.max(...heads.map((line) => line.top)) + 0.5 * body;
    for (const page of pages) {
      const first = page.lines[0];
      if (first && page.number > 1 && first.top <= zone && first.size < body * 0.95) out.add(first);
    }
  }
  return out;
}

export function pagesToHtml(pages: PdfPage[]): string {
  if (!pages.some((page) => page.lines.length)) throw new ImportError("scan", "The PDF has no text — scanned pages");
  const skip = furniture(pages, bodySize(pages));
  const layout = measure(pages, skip);
  const { body, pitch } = layout;
  const isBody = (line: PdfLine) => Math.abs(line.size - body) < 0.1 * body;

  const html: string[] = [];
  let paragraph: string[] | null = null;
  let notes: string[] = [];
  let pageBreak = false;

  const close = () => {
    if (paragraph) html.push(`<p>${paragraph.join("<br>")}</p>`);
    paragraph = null;
    // Footnotes of the page right after the paragraph the page ended in.
    for (const note of notes) html.push(`<p>${note}</p>`);
    notes = [];
  };
  const block = (markup: string) => {
    close();
    if (pageBreak) html.push(PAGE_BREAK_HTML);
    pageBreak = false;
    html.push(markup);
  };
  const start = (line: string) => {
    close();
    if (pageBreak) html.push(PAGE_BREAK_HTML);
    pageBreak = false;
    paragraph = [line];
  };

  for (const page of pages) {
    const lines = page.lines.filter((line) => !skip.has(line) && lineText(line).trim());
    const parity = page.number % 2 ? 1 : 0;
    const left = layout.left[parity] || Math.min(...lines.map((line) => line.left));
    // Short books have few full lines to measure the right edge by: the margins mirror
    // between odd and even pages, so the other side's left margin is this side's right one.
    const right = Math.max(layout.right[parity] ?? 0, page.width - (layout.left[parity ? 0 : 1] || left));
    const center = (left + right) / 2;
    const centered = (line: PdfLine) =>
      Math.abs((line.left + line.right) / 2 - center) < 1.5 * line.size && line.right - line.left < 0.85 * (right - left) && line.left - left > 2 * line.size;
    const allItalic = (line: PdfLine) => line.runs.every((run) => run.italic || !run.text.trim());
    // A line that stops well short of the edge after a full stop: the paragraph ended
    // (for text without indents, like a heading set flush left in a manuscript).
    const endsParagraph = (line: PdfLine) => line.right < right - 2 * body && /[.!?…"”»:]$/u.test(lineText(line).trim());
    const lastBody = lines.findLastIndex(isBody);
    const words = wordCount(lines.map(lineText).join(" "));
    const firstNote = lines.findIndex(
      (line, i) => i > 0 && line.noteStart && (line.top - lines[i - 1]!.top > 1.6 * pitch || line.size < body * 0.9),
    );
    const smaller = lines.findIndex((line, i) => i > lastBody && line.size < body * 0.9);
    const notesFrom = firstNote !== -1 ? firstNote : smaller !== -1 ? smaller : lines.length;

    // The first page, if short, is the title page: its lines as they are.
    if (page.number === 1 && words <= 60) {
      for (const line of lines) block(`<p>${runsHtml(line.runs.map((run) => ({ ...run, text: unspace(run.text) })))}</p>`);
      pageBreak = true;
      continue;
    }

    let afterText = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const text = lineText(line);
      // The page's footnotes: from the first numbered note under a gap (or in smaller type) to the
      // foot of the page. A note's own next lines join it; a new number starts the next note.
      if (i >= notesFrom) {
        if (line.noteStart || !notes.length) notes.push(runsHtml(line.runs));
        else notes[notes.length - 1] += `<br>${runsHtml(line.runs)}`;
        continue;
      }
      const previous = lines[i - 1];
      const gap = previous ? line.top - previous.top : 0;
      // A page whose text begins well below where text pages begin: a new part. In a short
      // book most pages are such pages, so a fifth of the page down counts too.
      const lowStart = i === 0 && line.top > Math.min(layout.textTop + 3 * pitch, 0.18 * page.height);
      const big = line.size >= body * 1.15 && wordCount(text) <= 10;

      // A part's heading: in bigger type, or centered at the start of a page that begins low (a new part).
      if (big || (lowStart && centered(line) && !allItalic(line))) {
        let end = i;
        while (end + 1 < lines.length) {
          const next = lines[end + 1]!;
          const nextBig = next.size >= body * 1.15;
          const near = next.top - lines[end]!.top < 2.5 * Math.max(pitch, next.size);
          if (!near || !centered(next) || (!nextBig && !lowStart) || wordCount(lineText(next)) > 10) break;
          end++;
        }
        // Centered lines alone on a page that begins low, in body type: a dedication, not a heading.
        if (big || lines.slice(end + 1).some((next) => !centered(next))) {
          const heading = lines.slice(i, end + 1).map((part) => runsHtml(part.runs.map((run) => ({ ...run, text: unspace(run.text) }))));
          block(`<h1>${heading.join("<br>")}</h1>`);
          i = end;
          afterText = false;
          continue;
        }
      }

      // A blank stretch inside the text where the scene break was drawn.
      if (afterText && gap > 2.5 * pitch) block("<p>* * *</p>");
      afterText = true;
      const indented = line.left - left > 0.5 * line.size && !centered(line);
      const markup = runsHtml(line.runs);
      if (centered(line)) {
        block(`<p style="text-align:center">${markup}</p>`);
      } else if (!paragraph || indented || (previous && (gap > 1.6 * pitch || endsParagraph(previous)))) {
        start(markup);
      } else {
        paragraph.push(markup);
      }
    }
    // A paragraph may go on over the page; a new page that starts indented or with a heading closes it.
    pageBreak = true;
    if (paragraph) {
      const next = pages[pages.indexOf(page) + 1]?.lines.find((line) => !skip.has(line) && lineText(line).trim());
      const lastLine = lines.findLast((line) => isBody(line));
      const ended = lastLine && lastLine.right < right - 2 * body && /[.!?…"”»]$/u.test(lineText(lastLine).trim());
      if (next && !ended && !(next.left - (layout.left[next.page % 2] || left) > 0.5 * next.size)) pageBreak = false;
    }
  }
  close();
  return `<body>${html.join("")}</body>`;
}

export async function pdfToHtml(data: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data, fontExtraProperties: true, disableFontFace: true });
  try {
    return pagesToHtml(await readPdfPages(await task.promise));
  } finally {
    void task.destroy();
  }
}
