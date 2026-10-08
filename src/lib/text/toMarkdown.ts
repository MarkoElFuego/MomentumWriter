import type { JSONContent } from "@tiptap/react";

// Markdown export (Faza 5): a safety copy of the manuscript that any text
// editor can open. Only the text and its structure — alignment, later notes,
// strike/underline from pasted text are not part of the copy.

export interface PartMarkdown {
  body: string;
  /** Footnote texts in reference order; numbered by the caller. */
  notes: string[];
}

/** One part's document → Markdown. Footnotes are numbered from `firstNote`. */
export function partToMarkdown(content: JSONContent, firstNote = 1): PartMarkdown {
  const noteText = new Map<string, JSONContent[]>();
  for (const block of content.content ?? []) {
    if (block.type !== "footnotes") continue;
    for (const note of block.content ?? []) noteText.set(String(note.attrs?.id), note.content ?? []);
  }

  const notes: string[] = [];
  const context: InlineContext = {
    ref: (id) => {
      notes.push(inline(noteText.get(id) ?? [], context).replace(/\n/g, " "));
      return `[^${firstNote + notes.length - 1}]`;
    },
  };

  const body = blocks((content.content ?? []).filter((b) => b.type !== "footnotes"), context);
  return { body, notes };
}

interface InlineContext {
  /** Called once per footnote mark, in text order; returns the reference. */
  ref: (id: string) => string;
}

function blocks(nodes: JSONContent[], context: InlineContext): string {
  return nodes
    .map((node) => block(node, context))
    .filter((text) => text !== "")
    .join("\n\n");
}

function block(node: JSONContent, context: InlineContext): string {
  switch (node.type) {
    case "paragraph":
      return escapeLineStarts(inline(node.content ?? [], context));
    case "heading": {
      const text = inline(node.content ?? [], context).replace(/\n/g, " ");
      // The part title is ##; headings inside the text come below it.
      return text ? `${node.attrs?.level === 2 ? "####" : "###"} ${text}` : "";
    }
    case "blockquote": {
      const text = blocks(node.content ?? [], context);
      return text ? prefixLines(text, "> ", ">") : "";
    }
    case "sceneBreak":
      return "* * *";
    case "bulletList":
    case "orderedList":
      return (node.content ?? [])
        .map((item, index) => {
          const marker = node.type === "orderedList" ? `${index + 1}. ` : "- ";
          const text = blocks(item.content ?? [], context);
          return marker + text.replace(/\n/g, `\n${" ".repeat(marker.length)}`);
        })
        .join("\n");
    default:
      // Anything unknown still keeps its text.
      return node.content ? blocks(node.content, context) : "";
  }
}

interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
}

/** Inline content: neighboring texts with the same emphasis are wrapped together. */
function inline(nodes: JSONContent[], context: InlineContext): string {
  const parts: (Run | string)[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      const marks = node.marks?.map((m) => m.type) ?? [];
      const run = { text: escapeText(node.text ?? ""), bold: marks.includes("bold"), italic: marks.includes("italic") };
      const last = parts[parts.length - 1];
      if (typeof last === "object" && last.bold === run.bold && last.italic === run.italic) last.text += run.text;
      else parts.push(run);
    } else if (node.type === "hardBreak") {
      parts.push("\\\n");
    } else if (node.type === "footnoteRef") {
      parts.push(context.ref(String(node.attrs?.id)));
    }
  }
  return parts.map((part) => (typeof part === "string" ? part : emphasize(part))).join("");
}

/** `*kurziv*`, `**podebljano**` — spaces stay outside the markers, or Markdown ignores them. */
function emphasize({ text, bold, italic }: Run): string {
  const marker = (bold ? "**" : "") + (italic ? "*" : "");
  if (!marker) return text;
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  const [, lead, core, trail] = match;
  return core ? `${lead}${marker}${core}${[...marker].reverse().join("")}${trail}` : text;
}

/** Characters that would turn prose into formatting. */
function escapeText(text: string): string {
  return text.replace(/[\\*_`[\]<]/g, "\\$&");
}

/** "- Gde si?" or "1. maj" at the start of a line is prose, not a list or a heading. */
function escapeLineStarts(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^([#>+=-])/, "\\$1").replace(/^(\d+)([.)])(?=\s|$)/, "$1\\$2"))
    .join("\n");
}

function prefixLines(text: string, prefix: string, emptyPrefix: string): string {
  return text
    .split("\n")
    .map((line) => (line ? prefix + line : emptyPrefix))
    .join("\n");
}

/** A file name the OS accepts: the book title and the day of the copy. */
export function exportFileName(title: string, now: Date): string {
  const safe = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim() || "knjiga";
  const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
  return `${safe} ${day}.md`;
}
