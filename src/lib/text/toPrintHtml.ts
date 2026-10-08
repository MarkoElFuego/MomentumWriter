import type { JSONContent } from "@tiptap/react";

// PDF export (Faza 5): a part's document as plain HTML for the print page,
// laid out like a book. Same content as the Markdown copy — alignment is kept
// here, later notes, strike and underline from pasted text are not.

export interface PartHtml {
  body: string;
  /** Footnote texts as HTML, in reference order; numbered by the caller. */
  notes: string[];
}

/** One part's document → HTML. Footnotes are numbered from `firstNote`. */
export function partToPrintHtml(content: JSONContent, sceneBreak: string, firstNote = 1): PartHtml {
  const noteText = new Map<string, JSONContent[]>();
  for (const block of content.content ?? []) {
    if (block.type !== "footnotes") continue;
    for (const note of block.content ?? []) noteText.set(String(note.attrs?.id), note.content ?? []);
  }

  const notes: string[] = [];
  const context: Context = {
    sceneBreak,
    ref: (id) => {
      notes.push(inline(noteText.get(id) ?? [], context));
      const n = firstNote + notes.length - 1;
      return `<sup class="note-ref"><a href="#fn-${n}" id="fnref-${n}">${n}</a></sup>`;
    },
  };

  const body = blocks((content.content ?? []).filter((b) => b.type !== "footnotes"), context);
  return { body, notes };
}

/** True when the part has anything to print (text or a scene break). */
export function hasPrintableText(content: JSONContent): boolean {
  const visit = (node: JSONContent): boolean =>
    node.type === "footnotes"
      ? false
      : (node.type === "text" && (node.text ?? "").trim() !== "") ||
        node.type === "sceneBreak" ||
        (node.content ?? []).some(visit);
  return visit(content);
}

interface Context {
  sceneBreak: string;
  /** Called once per footnote mark, in text order; returns the reference. */
  ref: (id: string) => string;
}

function blocks(nodes: JSONContent[], context: Context): string {
  return nodes.map((node) => block(node, context)).join("");
}

function block(node: JSONContent, context: Context): string {
  switch (node.type) {
    case "paragraph": {
      const text = inline(node.content ?? [], context);
      // An empty line in the manuscript is not a gap in the book.
      return text ? `<p${align(node)}>${text}</p>` : "";
    }
    case "heading": {
      const text = inline(node.content ?? [], context);
      // The part title is the page's h2; headings inside the text come below it.
      const tag = node.attrs?.level === 2 ? "h4" : "h3";
      return text ? `<${tag}${align(node)}>${text}</${tag}>` : "";
    }
    case "blockquote": {
      const text = blocks(node.content ?? [], context);
      return text ? `<blockquote>${text}</blockquote>` : "";
    }
    case "sceneBreak":
      return `<p class="scene-break" aria-label="prelom scene">${escapeHtml(context.sceneBreak)}</p>`;
    case "bulletList":
    case "orderedList": {
      const tag = node.type === "orderedList" ? "ol" : "ul";
      const items = (node.content ?? []).map((item) => `<li>${blocks(item.content ?? [], context)}</li>`).join("");
      return `<${tag}>${items}</${tag}>`;
    }
    default:
      // Anything unknown still keeps its text.
      return node.content ? blocks(node.content, context) : "";
  }
}

/** Left is the default and is never written; center and justify are the author's choice. */
function align(node: JSONContent): string {
  const value = node.attrs?.textAlign;
  return value === "center" || value === "justify" ? ` class="align-${value}"` : "";
}

function inline(nodes: JSONContent[], context: Context): string {
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "<br>";
      if (node.type === "footnoteRef") return context.ref(String(node.attrs?.id));
      if (node.type !== "text") return "";
      const marks = node.marks?.map((m) => m.type) ?? [];
      let html = escapeHtml(node.text ?? "");
      if (marks.includes("italic")) html = `<em>${html}</em>`;
      if (marks.includes("bold")) html = `<strong>${html}</strong>`;
      return html;
    })
    .join("");
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
