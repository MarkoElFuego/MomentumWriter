import type { JSONContent } from "@tiptap/react";

// Plain text of TipTap JSON, the way the editor reads it: blocks one per line,
// footnote numbers and scene breaks add nothing, so word counts match the editor.

/**
 * Not a node of the editor: a page break in the source (DOCX, PDF), only between
 * fromHtml and splitBook — it tells a dedication alone on its page. Never saved.
 */
export const PAGE_BREAK = "pageBreak";
/** How the DOCX and PDF readers mark it in their HTML. */
export const PAGE_BREAK_HTML = "<hr data-page-break>";

export function inlineText(content: JSONContent[] | undefined): string {
  return (content ?? []).map((node) => (node.type === "text" ? (node.text ?? "") : node.type === "hardBreak" ? "\n" : "")).join("");
}

const isTextBlock = (node: JSONContent) => node.type === "paragraph" || node.type === "heading" || node.type === "footnote";

export function blockText(block: JSONContent, separator = "\n"): string {
  if (isTextBlock(block)) return inlineText(block.content);
  return (block.content ?? []).map((child) => blockText(child, separator)).join(separator);
}

/** Everything that counts as words, footnotes included — like `editor.getText()`. */
export function docText(doc: JSONContent): string {
  return (doc.content ?? []).map((block) => blockText(block)).join("\n");
}

/** The prose only, paragraphs apart — for the first sentence. */
export function mainText(doc: JSONContent): string {
  return (doc.content ?? [])
    .filter((block) => block.type !== "footnotes")
    .map((block) => blockText(block, "\n\n"))
    .join("\n\n");
}
