import { Extension, mergeAttributes, Node } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Fragment, Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { copy } from "@/lib/copy";
import { newId } from "@/lib/db/id";

// A footnote is a numbered mark in the text (footnoteRef) plus its note in the
// zone at the very end of the chapter (footnotes > footnote). Both live in the
// same document, so autosave, undo and word count need nothing new. The zone
// always mirrors the marks: same ids, same order — numbers are never stored.

const REF = "footnoteRef";
const ZONE = "footnotes";
const NOTE = "footnote";

/** Chapter document: prose blocks, then at most one footnote zone at the end. */
const FootnoteDocument = Node.create({
  name: "doc",
  topNode: true,
  content: `block+ ${ZONE}?`,
});

const idAttribute = {
  id: {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute("data-id"),
    renderHTML: (attributes: Record<string, unknown>) => ({ "data-id": attributes.id }),
  },
};

const FootnoteRef = Node.create({
  name: REF,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return idAttribute;
  },

  parseHTML() {
    return [{ tag: "sup[data-footnote-ref]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["sup", mergeAttributes(HTMLAttributes, { "data-footnote-ref": "", class: "footnote-ref" })];
  },

  // The number is display only: no words, nothing in AI context.
  renderText() {
    return "";
  },
});

const FootnoteZone = Node.create({
  name: ZONE,
  content: `${NOTE}+`,
  isolating: true,

  parseHTML() {
    return [{ tag: "ol[data-footnotes]" }];
  },

  renderHTML() {
    return ["ol", { "data-footnotes": "", class: "footnotes", "aria-label": copy.footnotes.label }, 0];
  },
});

const FootnoteNote = Node.create({
  name: NOTE,
  // Plain text (marks allowed) — no nested footnotes, no paragraphs.
  content: "text*",

  addAttributes() {
    return idAttribute;
  },

  parseHTML() {
    return [{ tag: "li[data-footnote]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["li", mergeAttributes(HTMLAttributes, { "data-footnote": "", class: "footnote" }), 0];
  },
});

function zoneOf(doc: PMNode): PMNode | null {
  return doc.lastChild?.type.name === ZONE ? doc.lastChild : null;
}

/** Where the prose ends and the footnote zone (if any) begins. */
export function mainTextEnd(doc: PMNode): number {
  const zone = zoneOf(doc);
  return doc.content.size - (zone?.nodeSize ?? 0);
}

export function isInFootnote(state: EditorState): boolean {
  return state.selection.$from.parent.type.name === NOTE;
}

function refsOf(doc: PMNode): { id: string | null; pos: number }[] {
  const refs: { id: string | null; pos: number }[] = [];
  doc.forEach((block, offset) => {
    if (block.type.name === ZONE) return;
    block.descendants((node, pos) => {
      if (node.type.name === REF) refs.push({ id: node.attrs.id as string | null, pos: offset + 1 + pos });
    });
  });
  return refs;
}

/**
 * Brings the zone in line with the marks: one note per mark, in mark order.
 * Notes whose mark is gone are dropped; a mark without a note gets an empty
 * one; a copied mark gets a fresh id. Adds steps to `tr` (none if all is well).
 */
export function syncFootnotes(tr: Transaction, existingAt: ReadonlySet<number> = new Set()): Transaction {
  const refs = refsOf(tr.doc);
  // With duplicates, the mark that was already there keeps the id (and its note).
  const owner = new Map<string, number>();
  for (const { id, pos } of refs) {
    if (id && (!owner.has(id) || existingAt.has(pos))) owner.set(id, pos);
  }
  const seen = new Set<string>();
  const ids = refs.map(({ id, pos }) => {
    if (id && owner.get(id) === pos) {
      seen.add(id);
      return id;
    }
    const fresh = newId();
    seen.add(fresh);
    tr.setNodeMarkup(pos, undefined, { id: fresh });
    return fresh;
  });

  const zone = zoneOf(tr.doc);
  const notes = new Map<string, PMNode>();
  const current: (string | null)[] = [];
  zone?.forEach((note) => {
    const id = note.attrs.id as string | null;
    current.push(id);
    if (id && !notes.has(id)) notes.set(id, note);
  });
  if (current.length === ids.length && current.every((id, i) => id === ids[i])) return tr;

  const { schema } = tr.doc.type;
  const from = mainTextEnd(tr.doc);
  const to = tr.doc.content.size;
  if (ids.length === 0) return tr.delete(from, to);
  const rebuilt = ids.map((id) => notes.get(id) ?? schema.nodes[NOTE]!.create({ id }));
  return tr.replaceWith(from, to, schema.nodes[ZONE]!.create(null, rebuilt));
}

/** Mark at the cursor, note in the zone, cursor into the note. */
export function insertFootnoteTr(state: EditorState): Transaction | null {
  if (isInFootnote(state)) return null;
  const id = newId();
  const tr = syncFootnotes(state.tr.replaceSelectionWith(state.schema.nodes[REF]!.create({ id }), false));
  let target: number | null = null;
  zoneOf(tr.doc)?.forEach((note, offset) => {
    if (note.attrs.id === id) target = mainTextEnd(tr.doc) + 1 + offset + 1;
  });
  if (target === null) return null;
  return tr.setSelection(TextSelection.create(tr.doc, target)).scrollIntoView();
}

/** From inside a note back to the text, right after its number. */
export function leaveFootnoteTr(state: EditorState): Transaction | null {
  const { $from } = state.selection;
  if ($from.parent.type.name !== NOTE) return null;
  const ref = refsOf(state.doc).find(({ id }) => id === $from.parent.attrs.id);
  if (!ref) return null;
  return state.tr.setSelection(TextSelection.create(state.doc, ref.pos + 1)).scrollIntoView();
}

/** Backspace at the start / Delete at the end would merge two notes. */
export function atFootnoteEdge(state: EditorState, key: "Backspace" | "Delete"): boolean {
  const { selection } = state;
  const { $from } = selection;
  if (!selection.empty || $from.parent.type.name !== NOTE) return false;
  return key === "Backspace" ? $from.parentOffset === 0 : $from.parentOffset === $from.parent.content.size;
}

// Number and hover text for every mark, rebuilt only when the document changes.
function numberRefs(doc: PMNode): DecorationSet {
  const texts = new Map<string, string>();
  zoneOf(doc)?.forEach((note) => texts.set(note.attrs.id as string, note.textContent));
  const decorations = refsOf(doc).map(({ id, pos }, i) =>
    Decoration.node(pos, pos + 1, {
      "data-n": String(i + 1),
      title: (id && texts.get(id)) || "",
      "aria-label": copy.footnotes.refLabel(i + 1),
    }),
  );
  return DecorationSet.create(doc, decorations);
}

const footnotesKey = new PluginKey<DecorationSet>("footnotes");

export const footnotesPlugin = new Plugin<DecorationSet>({
  key: footnotesKey,
  state: {
    init: (_, state) => numberRefs(state.doc),
    apply: (tr, value, _old, state) => (tr.docChanged ? numberRefs(state.doc) : value),
  },
  // Runs inside the same history step as the edit, so one Ctrl+Z undoes both.
  appendTransaction(transactions, oldState, state) {
    if (!transactions.some((tr) => tr.docChanged)) return null;
    // Where the marks from before this edit are now.
    const existingAt = new Set(
      refsOf(oldState.doc).map(({ pos }) => transactions.reduce((p, tr) => tr.mapping.map(p), pos)),
    );
    const tr = syncFootnotes(state.tr, existingAt);
    return tr.docChanged ? tr : null;
  },
  props: {
    decorations: (state) => footnotesKey.getState(state),
    // A note is one line of text; pasted paragraphs are flattened into it.
    transformPasted(slice, view) {
      if (!isInFootnote(view.state)) return slice;
      const text = slice.content.textBetween(0, slice.content.size, " ", " ").replace(/\s+/g, " ");
      return text ? new Slice(Fragment.from(view.state.schema.text(text)), 0, 0) : Slice.empty;
    },
  },
});

export const Footnotes = Extension.create({
  name: "footnotesKit",

  addExtensions() {
    return [FootnoteDocument, FootnoteRef, FootnoteZone, FootnoteNote];
  },

  addProseMirrorPlugins() {
    return [footnotesPlugin];
  },
});
