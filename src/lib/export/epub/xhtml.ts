import type { JSONContent } from "@tiptap/react";

// One part's TipTap document → EPUB 3 XHTML body (ZADATAK_IZVOZ P8). The reader
// picks fonts and sizes; the stylesheet only indents and centers. Footnotes are
// EPUB 3 notes — a noteref in the text, an aside after the part — which Kindle
// and Apple Books open as a pop-up.

/** Text for XML: & < > " escaped (also inside attributes). */
export function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Numbers footnotes through the whole book, as the other formats do. */
export class NoteCounter {
  private n = 0;
  next(): number {
    return ++this.n;
  }
}

/** The body of a part: blocks, then its footnotes. "" when it has no text. */
export function partToXhtml(content: JSONContent, counter: NoteCounter): string {
  const source = new Map<string, JSONContent[]>();
  for (const block of content.content ?? []) {
    if (block.type !== "footnotes") continue;
    for (const note of block.content ?? []) source.set(String(note.attrs?.id), note.content ?? []);
  }
  const notes: string[] = [];
  const ctx: Ctx = { source, notes, counter };
  const body = blocks((content.content ?? []).filter((b) => b.type !== "footnotes"), ctx);
  return [body, ...notes].filter(Boolean).join("\n");
}

interface Ctx {
  source: Map<string, JSONContent[]>;
  notes: string[];
  counter: NoteCounter;
}

function blocks(nodes: JSONContent[], ctx: Ctx): string {
  return nodes
    .map((node) => block(node, ctx))
    .filter(Boolean)
    .join("\n");
}

function block(node: JSONContent, ctx: Ctx): string {
  switch (node.type) {
    case "paragraph": {
      const text = inline(node.content ?? [], ctx);
      if (!text) return "";
      return node.attrs?.textAlign === "center" ? `<p class="center">${text}</p>` : `<p>${text}</p>`;
    }
    case "heading": {
      const text = inline(node.content ?? [], ctx);
      return text ? `<h${node.attrs?.level === 2 ? 3 : 2}>${text}</h${node.attrs?.level === 2 ? 3 : 2}>` : "";
    }
    case "blockquote": {
      const inner = blocks(node.content ?? [], ctx);
      return inner ? `<blockquote>\n${inner}\n</blockquote>` : "";
    }
    case "sceneBreak":
      return `<p class="scene-break" role="separator">* * *</p>`;
    default:
      // Lists and anything unknown keep their text as paragraphs.
      return node.content ? blocks(node.content, ctx) : "";
  }
}

function inline(nodes: JSONContent[], ctx: Ctx): string {
  let out = "";
  let hasText = false;
  for (const node of nodes) {
    if (node.type === "text") {
      const text = node.text ?? "";
      if (text.trim()) hasText = true;
      const marks = node.marks?.map((m) => m.type) ?? [];
      let html = escapeXml(text);
      if (marks.includes("italic")) html = `<em>${html}</em>`;
      if (marks.includes("bold")) html = `<strong>${html}</strong>`;
      out += html;
    } else if (node.type === "hardBreak") {
      out += "<br/>";
    } else if (node.type === "footnoteRef") {
      hasText = true;
      const n = ctx.counter.next();
      const note = inline(ctx.source.get(String(node.attrs?.id)) ?? [], ctx);
      out += `<a epub:type="noteref" href="#note-${n}" id="ref-${n}" class="noteref">${n}</a>`;
      ctx.notes.push(
        `<aside epub:type="footnote" id="note-${n}" class="footnote"><p><a href="#ref-${n}">${n}</a> ${note}</p></aside>`,
      );
    }
  }
  return hasText ? out : "";
}
