import JSZip from "jszip";
import { PAGE_BREAK_HTML } from "./text";

// Uvoz (I2): a Word file (Word, LibreOffice, Google Docs → .docx) → HTML in the
// shape fromHtml already reads: headings by style, italic and bold, centered
// lines, real footnotes and endnotes as numbered links to a list at the end.
// Our own reader over jszip (already here for EPUB) instead of a converter
// library: DOCX is a ZIP of XML, and we need only the text and its layout.
// Loaded lazily — only when the author picks a .docx file.

export interface DocxImport {
  html: string;
  /** The document title from its properties, if the author's program wrote one. */
  title?: string;
}


interface StyleInfo {
  name: string;
  basedOn?: string;
  /** 1–6 for "heading N" or an outline level. */
  heading?: number;
  bold?: boolean;
  italic?: boolean;
  center?: boolean;
}

type Styles = Map<string, StyleInfo>;

const children = (element: Element | null | undefined, name?: string) =>
  [...(element?.children ?? [])].filter((child) => !name || child.localName === name);
const child = (element: Element | null | undefined, name: string) => children(element, name)[0];
const val = (element: Element | undefined) => element?.getAttribute("w:val") ?? undefined;
/** `<w:b/>` is on; `<w:b w:val="0"/>` or "false" is off. */
const isOn = (element: Element | undefined) => (element ? !["0", "false", "off", "none"].includes(val(element) ?? "") : undefined);

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, "application/xml");
}

function readStyles(xml: Document | null): Styles {
  const styles: Styles = new Map();
  for (const style of children(xml?.documentElement, "style")) {
    const id = style.getAttribute("w:styleId");
    if (!id) continue;
    const name = (val(child(style, "name")) ?? id).toLowerCase();
    const pPr = child(style, "pPr");
    const rPr = child(style, "rPr");
    const level = /^heading (\d)$/u.exec(name)?.[1] ?? (val(child(pPr, "outlineLvl")) !== undefined ? String(Number(val(child(pPr, "outlineLvl"))) + 1) : undefined);
    styles.set(id, {
      name,
      basedOn: val(child(style, "basedOn")),
      heading: level && Number(level) <= 6 ? Number(level) : undefined,
      bold: isOn(child(rPr, "b")),
      italic: isOn(child(rPr, "i")),
      center: val(child(pPr, "jc")) === "center" ? true : undefined,
    });
  }
  return styles;
}

/** A style with what it inherits: the nearest definition wins. */
function resolve(styles: Styles, id: string | undefined): StyleInfo | undefined {
  let info: StyleInfo | undefined;
  for (let current = id, depth = 0; current && depth < 10; depth++) {
    const style = styles.get(current);
    if (!style) break;
    info = info
      ? {
          ...info,
          heading: info.heading ?? style.heading,
          bold: info.bold ?? style.bold,
          italic: info.italic ?? style.italic,
          center: info.center ?? style.center,
        }
      : { ...style };
    current = style.basedOn;
  }
  return info;
}

class Reader {
  constructor(private readonly styles: Styles) {}

  /** Inline content of a paragraph (or of anything that holds runs). */
  inline(element: Element): { html: string; pageBreak: "none" | "before" | "after" } {
    let html = "";
    let pageBreak: "none" | "before" | "after" = "none";
    const walk = (node: Element) => {
      for (const item of children(node)) {
        switch (item.localName) {
          case "r": {
            const text = this.run(item);
            if (text.pageBreak) pageBreak = html.trim() ? "after" : "before";
            html += text.html;
            break;
          }
          // Deleted text in tracked changes is not the author's text any more.
          case "del":
          case "moveFrom":
          case "pPr":
          case "rPr":
          case "bookmarkStart":
          case "bookmarkEnd":
          case "proofErr":
            break;
          case "AlternateContent":
            // A text box or a picture with a fallback: counted as a picture (fromHtml leaves it out).
            if (item.getElementsByTagName("w:drawing").length || item.getElementsByTagName("w:pict").length) html += "<img>";
            else walk(child(item, "Fallback") ?? item);
            break;
          default:
            // hyperlink, ins, smartTag, fldSimple, sdt, customXml… — their runs count.
            walk(item.localName === "sdt" ? (child(item, "sdtContent") ?? item) : item);
        }
      }
    };
    walk(element);
    return { html, pageBreak };
  }

  run(run: Element): { html: string; pageBreak: boolean } {
    const rPr = child(run, "rPr");
    const style = resolve(this.styles, val(child(rPr, "rStyle")));
    const bold = isOn(child(rPr, "b")) ?? style?.bold ?? false;
    const italic = isOn(child(rPr, "i")) ?? style?.italic ?? false;
    let text = "";
    let pageBreak = false;
    for (const item of children(run)) {
      switch (item.localName) {
        case "t":
          text += escapeHtml(item.textContent ?? "");
          break;
        case "tab":
          text += "\t";
          break;
        case "br":
        case "cr":
          if (item.getAttribute("w:type") === "page") pageBreak = true;
          else text += "<br>";
          break;
        case "noBreakHyphen":
          text += "-";
          break;
        case "softHyphen":
          text += "­";
          break;
        case "footnoteReference":
        case "endnoteReference": {
          const kind = item.localName === "footnoteReference" ? "footnote" : "endnote";
          const id = item.getAttribute("w:id") ?? "";
          text += `<sup><a href="#${kind}-${id}" id="${kind}-ref-${id}">[${escapeHtml(id)}]</a></sup>`;
          break;
        }
        case "drawing":
        case "pict":
        case "object":
          text += "<img>";
          break;
        // instrText (field codes), footnoteRef (the number inside a note), delText… are not text.
      }
    }
    if (!text) return { html: "", pageBreak };
    if (italic) text = `<em>${text}</em>`;
    if (bold) text = `<strong>${text}</strong>`;
    return { html: text, pageBreak };
  }

  paragraph(p: Element): string {
    const pPr = child(p, "pPr");
    const style = resolve(this.styles, val(child(pPr, "pStyle")));
    const name = style?.name ?? "";
    // A generated table of contents is the program's text, not the author's.
    if (/^toc\b/u.test(name)) return "";
    const outline = val(child(pPr, "outlineLvl"));
    const level = outline !== undefined && Number(outline) < 6 ? Number(outline) + 1 : style?.heading;
    const jc = val(child(pPr, "jc"));
    const center = jc ? jc === "center" : style?.center;
    const { html, pageBreak } = this.inline(p);
    const attrs = center ? ' style="text-align:center"' : "";

    let block: string;
    // The title of the document is a title page line, not a chapter heading.
    if (level && name !== "title" && name !== "subtitle") block = `<h${level}${attrs}>${html}</h${level}>`;
    else if (/quote|citat/u.test(name)) block = `<blockquote><p${attrs}>${html}</p></blockquote>`;
    else block = `<p${attrs}>${html}</p>`;

    const before = isOn(child(pPr, "pageBreakBefore")) || pageBreak === "before";
    // A section break (its properties sit in the last paragraph of the section) starts a new page.
    const after = Boolean(child(pPr, "sectPr")) || pageBreak === "after";
    return `${before ? PAGE_BREAK_HTML : ""}${block}${after ? PAGE_BREAK_HTML : ""}`;
  }

  blocks(container: Element): string {
    return children(container)
      .map((item) => {
        switch (item.localName) {
          case "p":
            return this.paragraph(item);
          case "tbl":
            return `<table>${children(item, "tr")
              .map((row) => `<tr>${children(row, "tc").map((cell) => `<td>${this.blocks(cell)}</td>`).join("")}</tr>`)
              .join("")}</table>`;
          case "sdt":
            return this.blocks(child(item, "sdtContent") ?? item);
          case "customXml":
            return this.blocks(item);
          default:
            return "";
        }
      })
      .join("");
  }

  notes(xml: Document | null, kind: "footnote" | "endnote"): string {
    const items = children(xml?.documentElement, kind)
      .filter((note) => !note.getAttribute("w:type") || note.getAttribute("w:type") === "normal")
      .map((note) => `<li id="${kind}-${escapeHtml(note.getAttribute("w:id") ?? "")}">${this.blocks(note)}</li>`);
    return items.length ? `<ol>${items.join("")}</ol>` : "";
  }
}

export async function docxToHtml(data: ArrayBuffer | Uint8Array): Promise<DocxImport> {
  const zip = await JSZip.loadAsync(data);
  const read = async (name: string) => {
    const file = zip.file(name);
    return file ? parseXml(await file.async("string")) : null;
  };
  const document = await read("word/document.xml");
  if (!document) throw new Error("Not a Word document: word/document.xml is missing");
  const reader = new Reader(readStyles(await read("word/styles.xml")));
  const body = child(document.documentElement, "body");
  const html = [
    reader.blocks(body!),
    reader.notes(await read("word/footnotes.xml"), "footnote"),
    reader.notes(await read("word/endnotes.xml"), "endnote"),
  ].join("");

  const core = await read("docProps/core.xml");
  const title = core?.getElementsByTagName("dc:title")[0]?.textContent?.trim() || undefined;
  return { html: `<body>${html}</body>`, ...(title ? { title } : {}) };
}
