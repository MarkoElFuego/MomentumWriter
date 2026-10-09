import { copy } from "@/lib/copy";
import type { ExportBook, ExportSection } from "../buildBook";
import { escapeMarkup, typstString } from "../escape";
import { contentArg, sectionLabel, typstLang } from "./common";

// „Knjiga za štampu” (ZADATAK_IZVOZ P2, title page P5): the book as it would come from a printer —
// mirrored margins, every part on a right-hand page, running heads, page numbers
// only where a reader expects them.

export const PRINT_SIZES = ["a5", "13x20", "6x9", "a4"] as const;
export type PrintSize = (typeof PRINT_SIZES)[number];

export const COVER_STYLES = ["classic", "modern", "minimal"] as const;
export type CoverStyle = (typeof COVER_STYLES)[number];

export interface PrintOptions {
  size: PrintSize;
  /** A table of contents after the front matter. */
  toc?: boolean;
  /** The typographic title page (P5); classic when not given. */
  cover?: CoverStyle;
  /** Under the title; without it, the text of „Naslovna” (the older way) if there is one. */
  author?: string;
  /** Page and margins from elsewhere (Amazon KDP, P6) instead of `size`. */
  layout?: Layout;
  /** Only the title page — the e-book's cover image (P8). */
  coverOnly?: boolean;
}

export interface Layout {
  /** Typst page size, e.g. "width: 6in, height: 9in". */
  page: string;
  /** inside, outside, top, bottom — the inside is wider for the binding. */
  margin: [string, string, string, string];
  /** Text size, e.g. "11pt". */
  size: string;
}

// Margins grow with the page; text size 10.5–11 pt for book formats, 12 pt on A4.
const LAYOUT: Record<PrintSize, Layout> = {
  a5: { page: `paper: "a5"`, margin: ["20mm", "15mm", "18mm", "20mm"], size: "10.5pt" },
  "13x20": { page: "width: 130mm, height: 200mm", margin: ["18mm", "14mm", "17mm", "19mm"], size: "10.5pt" },
  "6x9": { page: "width: 6in, height: 9in", margin: ["21mm", "16mm", "19mm", "21mm"], size: "11pt" },
  a4: { page: `paper: "a4"`, margin: ["30mm", "22mm", "25mm", "28mm"], size: "12pt" },
};

export function printTemplate(book: ExportBook, options: PrintOptions): string {
  const { page, margin, size } = options.layout ?? LAYOUT[options.size];
  const [inside, outside, top, bottom] = margin;
  const preamble = `#set document(title: ${typstString(book.title)})
#let book-title = [${escapeMarkup(book.title)}]

// Every section leaves a start and an end mark; the header and footer read them to
// know which section a page belongs to and which pages are blank.
#let section-mark(kind, head) = [#metadata((kind: kind, head: head)) <section>]
#let end-mark = [#metadata(none) <section-end>]
#let page-info(p) = {
  let starts = query(<section>)
  let ends = query(<section-end>)
  let current = none
  let first = false
  let blank = false
  for (i, s) in starts.enumerate() {
    let sp = s.location().page()
    if sp <= p { current = s.value; first = sp == p }
    if i > 0 and ends.len() >= i and ends.at(i - 1).location().page() < p and p < sp { blank = true }
  }
  (current: current, first: first, blank: blank)
}

#set page(
  ${page},
  margin: (inside: ${inside}, outside: ${outside}, top: ${top}, bottom: ${bottom}),
  numbering: "1",
  header: context {
    let p = here().page()
    let info = page-info(p)
    if info.current == none or info.first or info.blank or info.current.kind != "body" { return }
    set text(size: 0.75em, tracking: 0.08em)
    align(center, upper(if calc.even(p) { book-title } else { info.current.head }))
  },
  footer: context {
    let p = here().page()
    let info = page-info(p)
    if p == 1 or info.blank { return }
    align(center, text(size: 0.85em, counter(page).display()))
  },
)
// top-edge 1em + leading 0.35em: baselines 1.35 × the text size apart.
#set text(font: "Literata", size: ${size}, lang: "${typstLang(book.language)}", hyphenate: true,
  top-edge: 1em, bottom-edge: 0em, costs: (widow: 1000%, orphan: 1000%))
// all: false — the first paragraph after a heading, scene break or quote is not indented.
#set par(justify: true, leading: 0.35em, spacing: 0.35em, first-line-indent: (amount: 1.2em, all: false))
#set footnote.entry(separator: line(length: 30%, stroke: 0.4pt), gap: 0.4em)
#show footnote.entry: set text(size: 0.82em)

// ✱ ✱ ✱ drawn, not typed: Literata has no ✱, and a missing glyph prints as a box.
#let star = box(width: 0.62em, height: 0.62em, baseline: 0.05em, {
  for angle in (0deg, 60deg, 120deg) {
    place(center + horizon, rotate(angle, line(length: 0.62em, stroke: (thickness: 0.13em, cap: "round"))))
  }
})
#let scenebreak() = block(width: 100%, above: 1.1em, below: 1.1em, align(center)[#star #h(0.5em) #star #h(0.5em) #star])
#let centered(body) = block(width: 100%, align(center, body))
#let blockquote(body) = block(inset: (x: 1.6em), above: 0.9em, below: 0.9em, text(size: 0.95em, body))
#let subheading(level, body) = block(width: 100%, above: 1.4em, below: 0.7em, sticky: true,
  align(center, if level == 1 { text(size: 1.1em, body) } else { emph(body) }))

// The title page (P5): title and author only, no picture. The title's size follows
// the page width (\`w\` = 1% of it), so it looks the same on every page size;
// a long title wraps.
#let covers = (
  classic: (author, w) => {
    v(20%)
    align(center)[
      #text(size: 6.2 * w, hyphenate: false, book-title)
      #v(1.6em)
      #line(length: 18%, stroke: 0.5pt)
      #if author != none { v(1.4em); text(size: 0.95em, tracking: 0.14em, upper(author)) }
    ]
  },
  modern: (author, w) => {
    if author != none { text(size: 0.95em, tracking: 0.06em, author) }
    v(1fr)
    line(length: 100%, stroke: 1.2pt)
    v(0.8em)
    text(size: 7.4 * w, weight: "bold", hyphenate: false, book-title)
    v(16%)
  },
  minimal: (author, w) => {
    v(1fr)
    align(center)[
      #text(size: 3.1 * w, hyphenate: false, book-title)
      #if author != none { v(0.9em); text(size: 0.8em, author) }
    ]
    v(1.4fr)
  },
)
#let title-page(style, author) = page(numbering: none)[
  #set par(first-line-indent: 0em, justify: false)
  #section-mark("front", none)
  #context (covers.at(style))(author, page.width / 100)
  #end-mark
]
#let dedication(body) = {
  pagebreak(to: "odd", weak: true)
  section-mark("front", none)
  v(24%)
  block(width: 100%, align(center, emph(body)))
  end-mark
}
#let part(kind: "body", label: none, title: none, head: none, body) = {
  pagebreak(to: "odd", weak: true)
  section-mark(kind, head)
  v(14%)
  block(width: 100%, below: 12mm, sticky: true, align(center)[
    #if label != none { text(size: 0.85em, tracking: 0.12em, upper(label)); linebreak() }
    #if title != none { text(size: 1.45em, title) }
  ])
  body
  end-mark
}
`;

  const titlePage = book.sections.find((s) => s.role === "titlePage");
  const author = options.author?.trim();
  const byline = author ? `[${escapeMarkup(author)}]` : titlePage ? `[${titlePage.body}]` : "none";
  const rest = book.sections.filter((s) => s.role !== "titlePage");
  const front = rest.filter((s) => s.kind === "front");
  const main = rest.filter((s) => s.kind !== "front");
  const cover = `#title-page("${options.cover ?? "classic"}", ${byline})`;
  if (options.coverOnly) return [preamble, cover].join("\n\n");
  return [
    preamble,
    cover,
    ...front.map(section),
    ...(options.toc && main.length ? [contents(main)] : []),
    ...main.map(section),
  ].join("\n\n");
}

function section(s: ExportSection): string {
  if (s.role === "dedication") return `#dedication[${s.body}]`;
  const kind = s.kind === "front" ? "front" : "body";
  return `#part(kind: "${kind}", label: ${contentArg(sectionLabel(s))}, title: ${contentArg(s.title)}, head: ${contentArg(runningHead(s))})[\n${s.body}\n]`;
}

/** The odd-page running head: the part's name, or "Poglavlje IV" for a chapter without one. */
function runningHead(s: ExportSection): string {
  return s.title || sectionLabel(s) || "";
}

/** Table of contents: chapters and back matter with the page each starts on. */
function contents(main: ExportSection[]): string {
  const entries = main.map((s) => {
    const name = s.number ? copy.structure.chapterLabel(s.number, s.title) : s.title;
    return `[${escapeMarkup(name)}]`;
  });
  return `#part(kind: "front", title: [${escapeMarkup(copy.export.contents)}])[
  #let entries = (${entries.join(", ")},)
  #context {
    let pages = query(<section>).filter(m => m.value.kind == "body").map(m => m.location().page())
    set par(first-line-indent: 0em, justify: false)
    for (i, name) in entries.enumerate() {
      block(above: 0.7em, below: 0.7em, [#name #box(width: 1fr, repeat[#h(0.3em).]) #h(0.3em) #pages.at(i, default: "")])
    }
  }
]`;
}
