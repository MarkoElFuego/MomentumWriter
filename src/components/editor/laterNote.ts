import { Mark, mergeAttributes } from "@tiptap/react";
import type { Mark as PMMark, Node as PMNode } from "@tiptap/pm/model";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { newId } from "@/lib/db/id";
import type { LaterNoteEntry } from "@/lib/text/laterNotes";
import { isInFootnote, mainTextEnd } from "./footnotes";

// Beleška za kasnije (Tiron T3): the author marks a place and writes down what
// to fix later instead of fixing it now. It lives in the part's JSON like the
// footnotes, so it needs no table of its own. Ticking it off removes the mark.

export const LATER_NOTE = "laterNote";
/** Longer notes are cut — it is a reminder, not a second manuscript. */
export const LATER_NOTE_CHARS = 200;

export const LaterNote = Mark.create({
  name: LATER_NOTE,
  // Typing at the end of a marked word doesn't grow the note.
  inclusive: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-later-note"),
        renderHTML: (attributes) => ({ "data-later-note": attributes.id }),
      },
      note: {
        default: "",
        parseHTML: (element) => element.getAttribute("title") ?? "",
        // The tooltip on hover.
        renderHTML: (attributes) => ({ title: attributes.note }),
      },
      createdAt: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute("data-created")) || 0,
        renderHTML: (attributes) => ({ "data-created": String(attributes.createdAt) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-later-note]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "later-note" }), 0];
  },
});

export interface TextRange {
  from: number;
  to: number;
}

const WORD_CHAR = /[\p{L}\p{N}'’-]/u;

/** The word at the cursor, or the one just before it ("Petar je |"). Null in an empty line. */
function wordAt(state: EditorState): TextRange | null {
  const { $from } = state.selection;
  const block = $from.parent;
  if (!block.isTextblock) return null;
  // One character per position: atoms (footnote numbers, line breaks) become a placeholder.
  const text = block.textBetween(0, block.content.size, "", "￼");
  const isWord = (i: number) => i >= 0 && i < text.length && WORD_CHAR.test(text[i]!);

  let at = $from.parentOffset;
  if (!isWord(at) && !isWord(at - 1)) {
    while (at > 0 && /\s/u.test(text[at - 1]!)) at--;
    if (!isWord(at - 1)) return null;
  }
  let start = isWord(at) ? at : at - 1;
  let end = start;
  while (isWord(start - 1)) start--;
  while (isWord(end)) end++;
  const base = $from.start();
  return { from: base + start, to: base + end };
}

/** What a new note goes on: the selection (main text only) or the word at the cursor. */
export function laterNoteRangeAt(state: EditorState): TextRange | null {
  if (isInFootnote(state)) return null;
  const { selection, doc } = state;
  if (selection.empty) return wordAt(state);
  const to = Math.min(selection.to, mainTextEnd(doc));
  if (selection.from >= to || !doc.textBetween(selection.from, to, " ").trim()) return null;
  return { from: selection.from, to };
}

export interface LaterNoteMark {
  id: string;
  note: string;
  createdAt: number;
}

function noteMark(node: PMNode | null | undefined): PMMark | undefined {
  return node?.marks.find((mark) => mark.type.name === LATER_NOTE);
}

/** Every stretch of text carrying this note (Enter in the middle splits it in two). */
export function laterNoteRanges(doc: PMNode, id: string): (TextRange & { mark: PMMark })[] {
  const ranges: (TextRange & { mark: PMMark })[] = [];
  doc.descendants((node, pos) => {
    const mark = node.isInline ? noteMark(node) : undefined;
    if (!mark || mark.attrs.id !== id) return;
    const last = ranges.at(-1);
    if (last && last.to === pos && last.mark.eq(mark)) last.to = pos + node.nodeSize;
    else ranges.push({ from: pos, to: pos + node.nodeSize, mark });
  });
  return ranges;
}

/** The note the cursor (or the start of the selection) is in. */
export function laterNoteAtCursor(state: EditorState): LaterNoteMark | null {
  const { $from } = state.selection;
  const mark = noteMark($from.nodeAfter) ?? noteMark($from.nodeBefore);
  if (!mark?.attrs.id) return null;
  return { id: mark.attrs.id as string, note: mark.attrs.note as string, createdAt: mark.attrs.createdAt as number };
}

const clean = (note: string) => note.trim().slice(0, LATER_NOTE_CHARS);

export function addLaterNoteTr(state: EditorState, range: TextRange, note: string, now = Date.now(), id = newId()): Transaction | null {
  const text = clean(note);
  if (!text) return null;
  const mark = state.schema.marks[LATER_NOTE]!.create({ id, note: text, createdAt: now });
  return state.tr.addMark(range.from, range.to, mark);
}

/** A new text for an existing note, on all its parts. */
export function updateLaterNoteTr(state: EditorState, id: string, note: string): Transaction | null {
  const text = clean(note);
  const ranges = laterNoteRanges(state.doc, id);
  if (!text || !ranges.length) return null;
  const tr = state.tr;
  for (const { from, to, mark } of ranges) {
    tr.removeMark(from, to, mark).addMark(from, to, mark.type.create({ ...mark.attrs, note: text }));
  }
  return tr;
}

/** Ticked off: the mark goes, the text stays. One Ctrl+Z brings it back. */
export function removeLaterNoteTr(state: EditorState, id: string): Transaction | null {
  const ranges = laterNoteRanges(state.doc, id);
  if (!ranges.length) return null;
  const tr = state.tr;
  for (const { from, to, mark } of ranges) tr.removeMark(from, to, mark);
  return tr;
}

/** The cursor at the start of the note (not a selection — typing must not replace the text). */
export function goToLaterNoteTr(state: EditorState, id: string): Transaction | null {
  const [first] = laterNoteRanges(state.doc, id);
  if (!first) return null;
  return state.tr.setSelection(TextSelection.create(state.doc, first.from)).scrollIntoView();
}

/** The open part's notes, straight from the editor — same shape as collectLaterNotes on saved JSON. */
export function laterNotesIn(doc: PMNode): LaterNoteEntry[] {
  const notes = new Map<string, LaterNoteEntry>();
  doc.descendants((node) => {
    const mark = node.isInline ? noteMark(node) : undefined;
    const id = mark?.attrs.id as string | undefined;
    if (!mark || !id) return;
    const existing = notes.get(id);
    if (existing) existing.text += node.text ?? "";
    else notes.set(id, { id, note: mark.attrs.note as string, createdAt: mark.attrs.createdAt as number, text: node.text ?? "" });
  });
  return [...notes.values()];
}
