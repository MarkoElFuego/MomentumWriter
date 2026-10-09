import { copy } from "@/lib/copy";
import type { Layout } from "./typst/templates/print.typ";

// Amazon KDP, paperback (ZADATAK_IZVOZ P6). Rules from the KDP help pages, checked
// 2026-10-09: "Set Trim Size, Bleed, and Margins", "Paperback Submission Guidelines",
// "Fix Paperback and Hardcover Formatting Issues". No bleed: the PDF page is the trim size.

export interface KdpTrim {
  id: string;
  /** Inches. */
  width: number;
  height: number;
  /** The four most used sizes go first in the list. */
  common?: boolean;
}

export const KDP_TRIMS: KdpTrim[] = [
  { id: "5x8", width: 5, height: 8, common: true },
  { id: "5.25x8", width: 5.25, height: 8, common: true },
  { id: "5.5x8.5", width: 5.5, height: 8.5, common: true },
  { id: "6x9", width: 6, height: 9, common: true },
  { id: "5.06x7.81", width: 5.06, height: 7.81 },
  { id: "6.14x9.21", width: 6.14, height: 9.21 },
  { id: "6.69x9.61", width: 6.69, height: 9.61 },
  { id: "7x10", width: 7, height: 10 },
  { id: "7.44x9.69", width: 7.44, height: 9.69 },
  { id: "7.5x9.25", width: 7.5, height: 9.25 },
  { id: "8x10", width: 8, height: 10 },
  { id: "8.25x6", width: 8.25, height: 6 },
  { id: "8.25x8.25", width: 8.25, height: 8.25 },
  { id: "8.5x8.5", width: 8.5, height: 8.5 },
  { id: "8.5x11", width: 8.5, height: 11 },
  { id: "8.27x11.69", width: 8.27, height: 11.69 },
];

/** Black ink: 24–828 pages on white paper, up to 776 on cream. */
export const KDP_PAGES = { min: 24, max: 828, maxCream: 776 } as const;

/** Smallest inside margin (inches) KDP allows for a page count. */
export function kdpGutter(pages: number): number {
  if (pages <= 150) return 0.375;
  if (pages <= 300) return 0.5;
  if (pages <= 500) return 0.625;
  if (pages <= 700) return 0.75;
  return 0.875;
}

const inches = (n: number) => `${Number(n.toFixed(3))}in`;

/**
 * Page and margins for a trim and page count. Outside, top and bottom are well
 * above KDP's 0.25 in; the inside is wider for the binding and never below KDP's minimum.
 */
export function kdpLayout(trim: KdpTrim, pages: number): Layout {
  const outside = trim.width < 6.5 ? 0.6 : 0.75;
  const inside = Math.max(outside + 0.15, kdpGutter(pages));
  const size = trim.width < 5.5 ? "10.5pt" : trim.width < 7 ? "11pt" : "12pt";
  return {
    page: `width: ${inches(trim.width)}, height: ${inches(trim.height)}`,
    margin: [inches(inside), inches(outside), inches(outside), inches(outside + 0.1)],
    size,
  };
}

/**
 * The page count depends on the inside margin, and the margin on the page count:
 * lay out with a guess, pick the margin for the pages it made, lay out again —
 * and a third time if that crossed into another row of the table.
 */
export async function layoutForKdp(
  build: (layout: Layout) => string,
  trim: KdpTrim,
  countPages: (source: string) => Promise<number>,
): Promise<{ source: string; pages: number; layout: Layout }> {
  let layout = kdpLayout(trim, KDP_PAGES.min);
  let source = build(layout);
  let pages = await countPages(source);
  for (let pass = 0; pass < 2; pass++) {
    const next = kdpLayout(trim, pages);
    if (next.margin[0] === layout.margin[0]) break;
    layout = next;
    source = build(layout);
    pages = await countPages(source);
  }
  return { source, pages, layout };
}

export interface KdpCheck {
  ok: boolean;
  text: string;
}

/** What KDP refuses, checked before the download. */
export function kdpChecks(input: { pages: number; trim: KdpTrim; title: string; author?: string }): KdpCheck[] {
  const t = copy.export.kdp;
  const { pages } = input;
  const pagesOk = pages >= KDP_PAGES.min && pages <= KDP_PAGES.max;
  const title = input.title.trim();
  return [
    {
      ok: pagesOk,
      text: pagesOk
        ? t.pagesOk(pages, pages > KDP_PAGES.maxCream)
        : pages < KDP_PAGES.min
          ? t.pagesTooFew(pages)
          : t.pagesTooMany(pages),
    },
    // Only KDP sizes are offered, so this holds; it is listed for the author to see.
    { ok: KDP_TRIMS.some((s) => s.id === input.trim.id), text: t.trimOk(t.trimName(input.trim.width, input.trim.height)) },
    // The layout leaves at most one blank page in a row (before a part on a right-hand page).
    { ok: true, text: t.blankOk },
    { ok: title !== "" && title !== copy.structure.defaultBookTitle, text: title && title !== copy.structure.defaultBookTitle ? t.titleOk : t.titleMissing },
    { ok: Boolean(input.author?.trim()), text: input.author?.trim() ? t.authorOk : t.authorMissing },
  ];
}
