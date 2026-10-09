import JSZip from "jszip";
import { copy } from "@/lib/copy";
import type { ExportBook, ExportSection } from "../typst/buildBook";
import { sectionLabel } from "../typst/templates/common";
import { NoteCounter, escapeXml, partToXhtml } from "./xhtml";

// E-knjiga as EPUB 3 (ZADATAK_IZVOZ P8), built here instead of with a library:
// an EPUB is a ZIP of a few XML files, and the EPUB libraries for JavaScript run
// only in Node or are no longer kept up. Checked with the official epubcheck
// (`pnpm check:epub`).

export interface EpubOptions {
  /** Stable identifier of the book (its id), so a new edition replaces the old one in a library. */
  id: string;
  author?: string;
  /** The typographic cover as PNG (P5 style); without it, no cover image. */
  cover?: Uint8Array;
  /** When the file was made — dc:date and dcterms:modified. */
  now: Date;
}

interface Item {
  id: string;
  href: string;
  type: string;
  properties?: string;
  /** In the reading order. */
  spine?: boolean;
}

const XHTML = "application/xhtml+xml";

export async function buildEpub(book: ExportBook, options: EpubOptions): Promise<Uint8Array> {
  const lang = book.language;
  const title = book.title;
  const author = options.author?.trim();
  const counter = new NoteCounter();
  const zip = new JSZip();

  // First and uncompressed, so a reader can tell what the file is.
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`,
  );

  const items: Item[] = [
    { id: "nav", href: "nav.xhtml", type: XHTML, properties: "nav" },
    { id: "style", href: "style.css", type: "text/css" },
  ];
  zip.file("OEBPS/style.css", STYLE);

  if (options.cover) {
    zip.file("OEBPS/images/cover.png", options.cover);
    items.push({ id: "cover-image", href: "images/cover.png", type: "image/png", properties: "cover-image" });
    zip.file(
      "OEBPS/cover.xhtml",
      page(lang, title, `<section epub:type="cover" class="cover"><img src="images/cover.png" alt="${escapeXml(title)}"/></section>`),
    );
    items.push({ id: "cover", href: "cover.xhtml", type: XHTML, spine: true });
  }

  // Title page: the author, or the text of „Naslovna” (the older way), as in print.
  const titleSection = book.sections.find((s) => s.role === "titlePage");
  const byline = author
    ? `<p class="author">${escapeXml(author)}</p>`
    : titleSection
      ? partToXhtml(titleSection.content, counter).replace(/<p>/g, '<p class="author">')
      : "";
  zip.file(
    "OEBPS/title.xhtml",
    page(lang, title, `<section epub:type="titlepage" class="titlepage">\n<h1 class="book-title">${escapeXml(title)}</h1>\n${byline}\n</section>`),
  );
  items.push({ id: "titlepage", href: "title.xhtml", type: XHTML, spine: true });

  const toc: { href: string; label: string }[] = [];
  let firstBody: string | undefined;
  book.sections
    .filter((s) => s.role !== "titlePage")
    .forEach((section, i) => {
      const href = `part-${String(i + 1).padStart(3, "0")}.xhtml`;
      const name = sectionName(section);
      zip.file(`OEBPS/${href}`, page(lang, name || title, sectionBody(section, counter)));
      items.push({ id: `part-${i + 1}`, href, type: XHTML, spine: true });
      if (section.role !== "dedication") toc.push({ href, label: name });
      if (!firstBody && section.kind === "chapter") firstBody = href;
    });

  zip.file("OEBPS/nav.xhtml", nav(lang, title, toc, firstBody, Boolean(options.cover)));
  zip.file("OEBPS/content.opf", opf(book, options, author, items));

  return zip.generateAsync({ type: "uint8array", mimeType: "application/epub+zip", compression: "DEFLATE" });
}

/** "Poglavlje IV · Dolazak", or the title of front and back matter. */
function sectionName(section: ExportSection): string {
  return section.number ? copy.structure.chapterHeading(section.number, section.title) : section.title;
}

function sectionBody(section: ExportSection, counter: NoteCounter): string {
  const text = partToXhtml(section.content, counter);
  if (section.role === "dedication") return `<section epub:type="dedication" class="dedication">\n${text}\n</section>`;
  const label = sectionLabel(section);
  const type = section.kind === "chapter" ? "chapter" : section.kind === "front" ? "frontmatter" : "backmatter";
  const heading = label
    ? `<h1><span class="label">${escapeXml(label)}</span>${section.title ? `<br/>${escapeXml(section.title)}` : ""}</h1>`
    : `<h1>${escapeXml(section.title)}</h1>`;
  return `<section epub:type="${type}">\n${heading}\n${text}\n</section>`;
}

function page(lang: string, title: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head>
<meta charset="UTF-8"/>
<title>${escapeXml(title)}</title>
<link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${body}
</body>
</html>
`;
}

function nav(lang: string, title: string, toc: { href: string; label: string }[], firstBody: string | undefined, cover: boolean): string {
  const entries = toc.map((t) => `      <li><a href="${t.href}">${escapeXml(t.label)}</a></li>`).join("\n");
  const landmarks = [
    cover ? `      <li><a epub:type="cover" href="cover.xhtml">${escapeXml(copy.export.epub.cover)}</a></li>` : "",
    `      <li><a epub:type="titlepage" href="title.xhtml">${escapeXml(title)}</a></li>`,
    firstBody ? `      <li><a epub:type="bodymatter" href="${firstBody}">${escapeXml(copy.export.epub.start)}</a></li>` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return page(
    lang,
    copy.export.contents,
    `<nav epub:type="toc" id="toc">
  <h1>${escapeXml(copy.export.contents)}</h1>
  <ol>
${entries || `      <li><a href="title.xhtml">${escapeXml(title)}</a></li>`}
  </ol>
</nav>
<nav epub:type="landmarks" hidden="hidden">
  <ol>
${landmarks}
  </ol>
</nav>`,
  );
}

function opf(book: ExportBook, options: EpubOptions, author: string | undefined, items: Item[]): string {
  // dcterms:modified wants seconds and Z, without milliseconds.
  const modified = options.now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const manifest = items
    .map((i) => `    <item id="${i.id}" href="${i.href}" media-type="${i.type}"${i.properties ? ` properties="${i.properties}"` : ""}/>`)
    .join("\n");
  const spine = items
    .filter((i) => i.spine)
    .map((i) => `    <itemref idref="${i.id}"/>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${book.language}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeXml(identifier(options.id))}</dc:identifier>
    <dc:title>${escapeXml(book.title)}</dc:title>
${author ? `    <dc:creator>${escapeXml(author)}</dc:creator>\n` : ""}    <dc:language>${book.language}</dc:language>
    <dc:date>${modified.slice(0, 10)}</dc:date>
    <meta property="dcterms:modified">${modified}</meta>
${items.some((i) => i.id === "cover-image") ? `    <meta name="cover" content="cover-image"/>\n` : ""}  </metadata>
  <manifest>
${manifest}
  </manifest>
  <spine>
${spine}
  </spine>
</package>
`;
}

/** The book's id: a UUID as urn:uuid, anything else in our own namespace. */
function identifier(id: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? `urn:uuid:${id.toLowerCase()}` : `urn:momentum:${id}`;
}

// The reader chooses font and size: only indents, centering and the notes.
const STYLE = `p { margin: 0; text-indent: 1.2em; }
h1 + p, h2 + p, h3 + p, .scene-break + p, blockquote + p, .center + p { text-indent: 0; }
h1 { text-align: center; font-weight: normal; margin: 3em 0 2em; page-break-before: always; }
h1 .label { font-size: 0.75em; letter-spacing: 0.1em; text-transform: uppercase; }
h2 { font-size: 1em; font-weight: bold; margin: 1.5em 0 0.5em; }
h3 { font-size: 1em; font-style: italic; font-weight: normal; margin: 1.2em 0 0.4em; }
.center { text-align: center; text-indent: 0; }
.scene-break { text-align: center; text-indent: 0; margin: 1em 0; }
blockquote { margin: 1em 1.5em; }
blockquote p { text-indent: 0; }
.titlepage { text-align: center; margin-top: 30%; }
.book-title { font-size: 1.8em; page-break-before: avoid; margin: 0 0 1.5em; }
.author { text-align: center; text-indent: 0; }
.dedication { text-align: center; font-style: italic; margin-top: 30%; }
.dedication p { text-indent: 0; }
.noteref { font-size: 0.75em; vertical-align: super; line-height: 0; text-decoration: none; }
.footnote { font-size: 0.85em; }
.footnote p { text-indent: 0; }
.cover { text-align: center; margin: 0; padding: 0; }
.cover img { max-width: 100%; max-height: 100%; }
`;
