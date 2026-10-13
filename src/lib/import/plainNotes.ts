import type { JSONContent } from "@tiptap/react";
import { tidyBlocks } from "@/components/editor/tidyText";
import { newId } from "@/lib/db/id";
import { inlineText } from "./text";

// Uvoz: footnotes written as text — "Svetonije[1]" in the text and "[1] Svetonije
// je…" further down (TXT, a paste without HTML, a PDF) — become real footnotes:
// each note is linked to the nearest mark with its number before it, so
// numbering that starts again in every chapter works too. A mark without a note
// or a note without a mark stays text. A „Napomene” line left with nothing
// under it goes as well — it was only the label of the notes.

/** "[1] Svetonije je…": a note, at the start of its paragraph. */
const NOTE = /^\s*\[(\d{1,4})\]\s*/u;
/** "Svetonije[1]", "telu[4].", "pedeset [6]" (a PDF keeps the number apart). */
const MARK = /(?:(?<=\S)| )\[(\d{1,4})\](?=$|[\s.,;:!?…)”"’»])/gu;
const NOTES_LABEL = /^\s*(napomene|napomena|beleške|fusnote|reference)\s*:?\s*$/iu;

export interface LinkedNotes {
  blocks: JSONContent[];
  notes: Map<string, JSONContent[]>;
  /** Mark and note numbers and the „Napomene” labels that went — for wordAudit. */
  dropped: string[];
  /** Marks that found no note: they stay text. */
  unlinked: number;
}

interface Mark {
  block: number;
  number: string;
  /** Order among all marks in the text — the same walk finds it again when replacing. */
  index: number;
  id?: string;
}

/** Text nodes of a block in order, inside quotes too (not in notes: those are top-level paragraphs). */
function forEachText(block: JSONContent, visit: (node: JSONContent) => void) {
  for (const node of block.content ?? []) {
    if (node.type === "text") visit(node);
    else if (node.content) forEachText(node, visit);
  }
}

const isNote = (block: JSONContent) => block.type === "paragraph" && NOTE.test(inlineText(block.content));

export function linkPlainNotes(source: JSONContent[]): LinkedNotes {
  const marks: Mark[] = [];
  source.forEach((block, i) => {
    if (isNote(block)) return;
    forEachText(block, (node) => {
      for (const match of (node.text ?? "").matchAll(MARK)) marks.push({ block: i, number: match[1]!, index: marks.length });
    });
  });

  const notes = new Map<string, JSONContent[]>();
  const dropped: string[] = [];
  const removed = new Set<number>();
  source.forEach((block, i) => {
    if (!isNote(block)) return;
    const number = NOTE.exec(inlineText(block.content))![1]!;
    const mark = marks.findLast((candidate) => candidate.block < i && candidate.number === number && !candidate.id);
    if (!mark) return;
    mark.id = newId();
    notes.set(mark.id, noteContent(block.content ?? []));
    dropped.push(`[${number}]`, `[${number}]`);
    removed.add(i);
  });
  if (!notes.size) return { blocks: source, notes, dropped: [], unlinked: marks.length };

  // „Napomene” right above notes that all went into footnotes.
  source.forEach((block, i) => {
    if (block.type !== "paragraph" && block.type !== "heading") return;
    if (!NOTES_LABEL.test(inlineText(block.content)) || !removed.has(i + 1)) return;
    let j = i + 1;
    while (j < source.length && isNote(source[j]!)) j++;
    for (let k = i + 1; k < j; k++) if (!removed.has(k)) return;
    removed.add(i);
    dropped.push(inlineText(block.content));
  });

  const ids = new Map(marks.filter((mark) => mark.id).map((mark) => [mark.index, mark.id!]));
  let counter = 0;
  const replace = (nodes: JSONContent[] | undefined): JSONContent[] | undefined =>
    nodes?.flatMap((node): JSONContent[] => {
      if (node.type !== "text") return [{ ...node, ...(node.content ? { content: replace(node.content) } : {}) }];
      const text = node.text ?? "";
      const out: JSONContent[] = [];
      let last = 0;
      for (const match of text.matchAll(MARK)) {
        const id = ids.get(counter++);
        if (!id) continue;
        // " [6]" from a PDF: the space was only there to keep the number apart.
        if (match.index > last) out.push({ ...node, text: text.slice(last, match.index) });
        out.push({ type: "footnoteRef", attrs: { id } });
        last = match.index + match[0].length;
      }
      if (last === 0) return [node];
      if (last < text.length) out.push({ ...node, text: text.slice(last) });
      return out;
    });

  const blocks = source.flatMap((block, i): JSONContent[] => {
    if (removed.has(i)) return [];
    if (isNote(block)) return [block];
    return [{ ...block, ...(block.content ? { content: replace(block.content) } : {}) }];
  });
  return { blocks, notes, dropped, unlinked: marks.length - notes.size };
}

/** The note without its "[1] ", tidied like „Sredi tekst”: marks kept, a note's lines joined into one. */
function noteContent(content: JSONContent[]): JSONContent[] {
  const [first, ...rest] = content;
  const start = first?.type === "text" ? [{ ...first, text: (first.text ?? "").replace(NOTE, "") }] : first ? [first] : [];
  return tidyBlocks([{ type: "paragraph", content: [...start, ...rest] }])[0]?.content ?? [];
}
