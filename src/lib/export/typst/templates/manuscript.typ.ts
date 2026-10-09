import { copy } from "@/lib/copy";
import type { ExportBook, ExportSection } from "../buildBook";
import { escapeMarkup, typstString } from "../escape";
import { contentArg, lines, sectionLabel, surname, typstLang } from "./common";

// „Rukopis za izdavača” (ZADATAK_IZVOZ): the standard manuscript format — A4,
// 12 pt, left aligned, no hyphenation, "Prezime / NASLOV / 12" in the header.
// P1 lays the groundwork; P3 refines it.

export interface ManuscriptOptions {
  author?: string;
  /** E-mail, phone… — one item per line. */
  contact?: string;
  /** Line spacing: 1,5 or double. */
  spacing: 1.5 | 2;
}

/** Leading (space between lines) that gives 1,5 or double spacing for 12 pt text. */
const LEADING = { 1.5: "1.05em", 2: "1.65em" } as const;

export function manuscriptTemplate(book: ExportBook, options: ManuscriptOptions): string {
  const author = options.author?.trim() ?? "";
  const runningHead = [surname(author), book.title.toLocaleUpperCase("sr")].filter(Boolean).map(escapeMarkup).join(" / ");
  const leading = LEADING[options.spacing];
  const genre = book.genre ? copy.book.genres[book.genre] : undefined;

  const preamble = `#set document(title: ${typstString(book.title)}${author ? `, author: ${typstString(author)}` : ""})
#set page(
  paper: "a4",
  margin: 2.5cm,
  header: context if here().page() > 1 {
    align(right, text(size: 10pt)[${runningHead} / #counter(page).display()])
  },
)
#set text(font: "Literata", size: 12pt, lang: "${typstLang(book.language)}", hyphenate: false)
#set par(justify: false, leading: ${leading}, spacing: ${leading}, first-line-indent: 1.25cm)

#let scenebreak() = block(width: 100%, above: ${leading}, below: ${leading}, align(center)[\\#])
#let centered(body) = block(width: 100%, align(center, body))
#let blockquote(body) = block(inset: (left: 1.25cm), above: ${leading}, below: ${leading}, body)
#let subheading(level, body) = block(above: 2em, below: 1em, sticky: true,
  if level == 1 { strong(body) } else { emph(body) })

#let dedication(body) = {
  pagebreak(weak: true)
  v(7cm)
  block(width: 100%, align(center, emph(body)))
}
#let part(label: none, title: none, body) = {
  pagebreak(weak: true)
  v(6cm)
  block(width: 100%, below: 2em, sticky: true, align(center)[
    #if label != none { label; linebreak() }
    #if title != none { title }
  ])
  body
}
`;

  const titlePage = `#page(header: none)[
  #grid(columns: (1fr, auto),
    [${[author, options.contact ?? ""].map(lines).filter(Boolean).join(" #linebreak(); ")}],
    [${escapeMarkup(copy.export.aboutWords(book.wordCount))}],
  )
  #v(1fr)
  #align(center)[
    #text(size: 16pt)[${escapeMarkup(book.title.toLocaleUpperCase("sr"))}]
    ${genre ? `#v(1em) ${escapeMarkup(genre)}` : ""}
    ${author ? `#v(1em) ${escapeMarkup(author)}` : ""}
  ]
  #v(1fr)
]
#counter(page).update(1)`;

  // The title page part („Naslovna”) is replaced by the standard manuscript title page.
  const sections = book.sections.filter((s) => s.role !== "titlePage").map(section);
  return [preamble, titlePage, ...sections].join("\n\n");
}

function section(s: ExportSection): string {
  if (s.role === "dedication") return `#dedication[${s.body}]`;
  return `#part(label: ${contentArg(sectionLabel(s))}, title: ${contentArg(s.title)})[\n${s.body}\n]`;
}
