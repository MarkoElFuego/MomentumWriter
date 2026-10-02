import { Extension } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { ProofEdit } from "@/lib/text/proofDiff";

// Language-check underlines. Like the gray text they are only decorations:
// nothing changes in the document until the author accepts a correction.

interface MarkSpec {
  id: number;
  edit: ProofEdit;
}

interface ProofState {
  decorations: DecorationSet;
  /** Mark whose popover is open; `focus` when opened from the keyboard. */
  open: { id: number; focus: boolean } | null;
}

export interface MarkRange {
  from: number;
  to: number;
  edit: ProofEdit;
}

type ProofMeta =
  | { type: "set"; from: number; to: number; marks: MarkRange[] }
  | { type: "remove"; ids: number[] }
  | { type: "open"; id: number; focus: boolean }
  | { type: "close" }
  | { type: "clear" };

const proofKey = new PluginKey<ProofState>("proofMarks");
let nextId = 1;

/**
 * What the author did with a correction — useProofread keeps its saved check
 * in step: a rejection is remembered, an acceptance carries the check over to
 * the paragraph's new text (no new API call). `pos` is the mark's start in
 * the document before the transaction.
 */
export type ProofEvent = { type: "accept"; pos: number } | { type: "reject"; pos: number; edit: ProofEdit };
export const PROOF_EVENT = "proofEvent";

export function proofEventOf(tr: Transaction): ProofEvent | undefined {
  return tr.getMeta(PROOF_EVENT) as ProofEvent | undefined;
}

function specOf(decoration: Decoration): MarkSpec {
  return decoration.spec as MarkSpec;
}

function decorate(from: number, to: number, edit: ProofEdit): Decoration {
  return Decoration.inline(
    from,
    to,
    { class: edit.type === "diacritic" ? "proof-mark proof-diacritic" : "proof-mark proof-grammar" },
    { id: nextId++, edit } satisfies MarkSpec,
  );
}

/**
 * The paragraph's text as the proofreader sees it, plus where each character
 * sits (offset inside the paragraph). A hard break reads as a line break; an
 * atom (footnote number) adds no text but is remembered, so no correction can
 * span it — accepting one would delete the footnote.
 */
export function paragraphText(node: PMNode): { text: string; offsets: number[]; atoms: number[] } {
  let text = "";
  const offsets: number[] = [];
  const atoms: number[] = [];
  node.forEach((child, offset) => {
    if (child.isText) {
      for (let k = 0; k < child.text!.length; k++) offsets.push(offset + k);
      text += child.text!;
    } else if (child.type.name === "hardBreak") {
      offsets.push(offset);
      text += "\n";
    } else {
      atoms.push(text.length);
    }
  });
  offsets.push(node.content.size);
  return { text, offsets, atoms };
}

/** Document ranges for the edits of the paragraph at `blockPos`. */
export function markRanges(node: PMNode, blockPos: number, edits: ProofEdit[]): MarkRange[] {
  const { offsets, atoms } = paragraphText(node);
  return edits
    .filter((edit) => !atoms.some((at) => at > edit.start && at < edit.end))
    .map((edit) => ({
      from: blockPos + 1 + offsets[edit.start]!,
      to: blockPos + 1 + offsets[edit.end - 1]! + 1,
      edit,
    }));
}

function findMark(state: EditorState, id: number): Decoration | undefined {
  return proofKey.getState(state)?.decorations.find(undefined, undefined, (spec) => (spec as MarkSpec).id === id)[0];
}

function markAt(state: EditorState, pos: number): Decoration | undefined {
  return proofKey
    .getState(state)
    ?.decorations.find(pos, pos)
    .find((d) => d.from <= pos && pos <= d.to);
}

export interface OpenProofMark {
  id: number;
  from: number;
  to: number;
  edit: ProofEdit;
  /** Diacritic marks in the same paragraph (for "accept all"). */
  diacriticsInParagraph: number;
  /** Opened with Alt+Enter → the popover takes focus; a click leaves it in the text. */
  focus: boolean;
}

function paragraphRange(state: EditorState, pos: number) {
  const $pos = state.doc.resolve(pos);
  return { from: $pos.start(), to: $pos.end() };
}

function diacriticMarksIn(state: EditorState, pos: number): Decoration[] {
  const { from, to } = paragraphRange(state, pos);
  return (proofKey.getState(state)?.decorations.find(from, to) ?? []).filter(
    (d) => specOf(d).edit.type === "diacritic",
  );
}

export function openProofMark(state: EditorState): OpenProofMark | null {
  const open = proofKey.getState(state)?.open;
  if (!open) return null;
  const mark = findMark(state, open.id);
  if (!mark) return null;
  return {
    id: open.id,
    focus: open.focus,
    from: mark.from,
    to: mark.to,
    edit: specOf(mark).edit,
    diacriticsInParagraph: diacriticMarksIn(state, mark.from).length,
  };
}

export function hasProofMarks(state: EditorState): boolean {
  return (proofKey.getState(state)?.decorations.find().length ?? 0) > 0;
}

/** Open underlines in the document, by kind — for "ovde: 4 kvačice · 1 gramatika". */
export function proofMarkCounts(state: EditorState): { diacritics: number; grammar: number } {
  const marks = proofKey.getState(state)?.decorations.find() ?? [];
  const diacritics = marks.filter((d) => specOf(d).edit.type === "diacritic").length;
  return { diacritics, grammar: marks.length - diacritics };
}

/** The next underline after the cursor (from the top after the last one), with its popover open. */
export function nextProofMarkTr(state: EditorState): Transaction | null {
  const marks = [...(proofKey.getState(state)?.decorations.find() ?? [])].sort((a, b) => a.from - b.from);
  const next = marks.find((d) => d.from > state.selection.from) ?? marks[0];
  if (!next) return null;
  const tr = state.tr.setSelection(TextSelection.create(state.doc, next.from)).scrollIntoView();
  return meta(tr, { type: "open", id: specOf(next).id, focus: true });
}

const meta = (tr: Transaction, value: ProofMeta) => tr.setMeta(proofKey, value);

/** Replaces the underlines of one paragraph (the range it covers now). */
export function setProofMarksTr(state: EditorState, from: number, to: number, marks: MarkRange[]) {
  return meta(state.tr, { type: "set", from, to, marks });
}

export function openProofTr(state: EditorState, id: number, focus: boolean) {
  return meta(state.tr, { type: "open", id, focus });
}

/** Alt+Enter: open the popover of the mark under the cursor. */
export function openProofAtCursorTr(state: EditorState): Transaction | null {
  const mark = markAt(state, state.selection.from);
  return mark ? openProofTr(state, specOf(mark).id, true) : null;
}

export function closeProofTr(state: EditorState) {
  return meta(state.tr, { type: "close" });
}

export function clearProofTr(state: EditorState) {
  return meta(state.tr, { type: "clear" });
}

/** The word becomes the correction, as if typed — one Ctrl+Z brings it back. */
export function acceptProofTr(state: EditorState, id: number): Transaction | null {
  const mark = findMark(state, id);
  if (!mark) return null;
  const tr = meta(state.tr.insertText(specOf(mark).edit.to, mark.from, mark.to), { type: "close" });
  return tr.setMeta(PROOF_EVENT, { type: "accept", pos: mark.from } satisfies ProofEvent);
}

export function rejectProofTr(state: EditorState, id: number) {
  const tr = meta(state.tr, { type: "remove", ids: [id] });
  const mark = findMark(state, id);
  if (mark) tr.setMeta(PROOF_EVENT, { type: "reject", pos: mark.from, edit: specOf(mark).edit } satisfies ProofEvent);
  return tr;
}

/** Every diacritic correction in the paragraph, in one undo step. */
export function acceptDiacriticsTr(state: EditorState, id: number): Transaction | null {
  const mark = findMark(state, id);
  if (!mark) return null;
  const tr = state.tr;
  // Right to left so earlier positions stay valid.
  for (const d of diacriticMarksIn(state, mark.from).sort((a, b) => b.from - a.from)) {
    tr.insertText(specOf(d).edit.to, d.from, d.to);
  }
  return meta(tr, { type: "close" }).setMeta(PROOF_EVENT, { type: "accept", pos: mark.from } satisfies ProofEvent);
}

export const proofMarksPlugin = new Plugin<ProofState>({
  key: proofKey,
  state: {
    init: () => ({ decorations: DecorationSet.empty, open: null }),
    apply(tr, value) {
      const action = tr.getMeta(proofKey) as ProofMeta | undefined;
      if (action?.type === "clear") return { decorations: DecorationSet.empty, open: null };

      let decorations = value.decorations.map(tr.mapping, tr.doc);
      let open = tr.docChanged ? null : value.open;
      // A word the author changed (or that a correction replaced) loses its underline.
      if (tr.docChanged) {
        decorations = decorations.remove(
          decorations.find().filter((d) => tr.doc.textBetween(d.from, d.to) !== specOf(d).edit.from),
        );
      }

      if (action?.type === "set") {
        decorations = decorations
          .remove(decorations.find(action.from, action.to))
          .add(tr.doc, action.marks.map(({ from, to, edit }) => decorate(from, to, edit)));
      } else if (action?.type === "remove") {
        decorations = decorations.remove(
          decorations.find(undefined, undefined, (spec) => action.ids.includes((spec as MarkSpec).id)),
        );
      } else if (action?.type === "open") {
        open = { id: action.id, focus: action.focus };
      } else if (action?.type === "close") {
        open = null;
      }
      const openId = open?.id;
      if (openId !== undefined && !decorations.find(undefined, undefined, (spec) => (spec as MarkSpec).id === openId).length) {
        open = null;
      }
      return { decorations, open };
    },
  },
  props: {
    decorations: (state) => proofKey.getState(state)?.decorations,
    // A click on an underlined word opens its popover; the cursor still moves there.
    handleClick(view, pos) {
      const mark = markAt(view.state, pos);
      if (mark) view.dispatch(openProofTr(view.state, specOf(mark).id, false));
      return false;
    },
  },
});

export const ProofMarks = Extension.create({
  name: "proofMarks",
  addProseMirrorPlugins() {
    return [proofMarksPlugin];
  },
});

export function dispatchIf(view: EditorView, tr: Transaction | null): boolean {
  if (tr) view.dispatch(tr);
  return tr !== null;
}
