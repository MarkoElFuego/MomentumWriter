import type { JSONContent } from "@tiptap/react";
import { escapeMarkup } from "./escape";

// One part's TipTap document → Typst markup (ZADATAK_IZVOZ P1). Structure that
// depends on the layout is a call to a function the template defines:
//   #centered[…]  #blockquote[…]  #subheading(1)[…]  #scenebreak()
// Left and justified alignment are the template's choice; center is the author's.
// Later notes, strike and underline from pasted text are not part of the book.
//
// Every #call ends with ";" — otherwise text right after it, such as "(" or
// ".Reč", would be read as the rest of the expression.

/** The body of one part as Typst markup; "" when it has no text. */
export function partToTypst(content: JSONContent): string {
  const notes = new Map<string, JSONContent[]>();
  for (const block of content.content ?? []) {
    if (block.type !== "footnotes") continue;
    for (const note of block.content ?? []) notes.set(String(note.attrs?.id), note.content ?? []);
  }
  return blocks((content.content ?? []).filter((b) => b.type !== "footnotes"), notes);
}

type Notes = Map<string, JSONContent[]>;

function blocks(nodes: JSONContent[], notes: Notes): string {
  return nodes
    .map((node) => block(node, notes))
    .filter((text) => text !== "")
    .join("\n\n");
}

function block(node: JSONContent, notes: Notes): string {
  switch (node.type) {
    case "paragraph": {
      const text = inline(node.content ?? [], notes);
      if (!text) return "";
      return node.attrs?.textAlign === "center" ? `#centered[${text}];` : text;
    }
    case "heading": {
      const text = inline(node.content ?? [], notes);
      return text ? `#subheading(${node.attrs?.level === 2 ? 2 : 1})[${text}];` : "";
    }
    case "blockquote": {
      const text = blocks(node.content ?? [], notes);
      return text ? `#blockquote[${text}];` : "";
    }
    case "sceneBreak":
      return "#scenebreak();";
    case "bulletList":
    case "orderedList": {
      const items = (node.content ?? []).map((item) => `[${blocks(item.content ?? [], notes)}]`);
      return items.length ? `#${node.type === "orderedList" ? "enum" : "list"}(${items.join(", ")});` : "";
    }
    default:
      // Anything unknown still keeps its text.
      return node.content ? blocks(node.content, notes) : "";
  }
}

interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
}

/** Inline content: neighboring texts with the same emphasis are wrapped together. */
function inline(nodes: JSONContent[], notes: Notes): string {
  const parts: (Run | string)[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      const marks = node.marks?.map((m) => m.type) ?? [];
      const run = { text: node.text ?? "", bold: marks.includes("bold"), italic: marks.includes("italic") };
      const last = parts[parts.length - 1];
      if (typeof last === "object" && last.bold === run.bold && last.italic === run.italic) last.text += run.text;
      else parts.push(run);
    } else if (node.type === "hardBreak") {
      parts.push("#linebreak();");
    } else if (node.type === "footnoteRef") {
      // The note's own text, right where its number is; Typst numbers and places it.
      parts.push(`#footnote[${inline(notes.get(String(node.attrs?.id)) ?? [], notes)}];`);
    }
  }
  const text = parts.map((part) => (typeof part === "string" ? part : emphasize(part))).join("");
  return text.trim() === "" ? "" : text;
}

function emphasize({ text, bold, italic }: Run): string {
  let out = escapeMarkup(text);
  if (!out.trim()) return out;
  if (italic) out = `#emph[${out}];`;
  if (bold) out = `#strong[${out}];`;
  return out;
}
