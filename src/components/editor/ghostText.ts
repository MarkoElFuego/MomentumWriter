import { Extension } from "@tiptap/react";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { nextWord } from "@/lib/text/ghost";

// Gray text shown right after the cursor. It is only a decoration — nothing
// reaches the document until the author accepts a suggestion. A "hint" is
// display-only (the empty-paragraph nudge) and can never be accepted.
type GhostState =
  | {
      kind: "suggest";
      pos: number;
      /** Ready to insert, including a leading space when one is needed. */
      items: string[];
      index: number;
    }
  | { kind: "hint"; pos: number; text: string };

type GhostMeta =
  | { type: "show"; pos: number; items: string[] }
  | { type: "hint"; pos: number; text: string }
  | { type: "step"; by: 1 | -1 }
  | { type: "advance"; consumed: number }
  | { type: "clear" };

const ghostKey = new PluginKey<GhostState | null>("ghost");

function render(ghost: GhostState): HTMLElement {
  const span = document.createElement("span");
  span.className = ghost.kind === "hint" ? "ghost-text ghost-hint" : "ghost-text";
  span.setAttribute("aria-hidden", "true");
  if (ghost.kind === "hint") {
    span.textContent = ghost.text;
    return span;
  }
  span.textContent = ghost.items[ghost.index]!;
  // Quiet hint that ↓/↑ has more to offer.
  if (ghost.items.length > 1) {
    const count = document.createElement("span");
    count.className = "ghost-count";
    count.textContent = `${ghost.index + 1}/${ghost.items.length}`;
    span.append(count);
  }
  return span;
}

export const GhostText = Extension.create({
  name: "ghostText",

  addProseMirrorPlugins() {
    return [
      new Plugin<GhostState | null>({
        key: ghostKey,
        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(ghostKey) as GhostMeta | undefined;
            if (meta?.type === "show") return { kind: "suggest", pos: meta.pos, items: meta.items, index: 0 };
            if (meta?.type === "hint") return { kind: "hint", pos: meta.pos, text: meta.text };
            if (meta?.type === "clear") return null;
            if (meta?.type === "step" && value?.kind === "suggest") {
              const count = value.items.length;
              return { ...value, index: (value.index + meta.by + count) % count };
            }
            if (meta?.type === "advance" && value?.kind === "suggest") {
              const rest = value.items[value.index]!.slice(meta.consumed);
              return rest.trim() === ""
                ? null
                : { kind: "suggest", pos: value.pos + meta.consumed, items: [rest], index: 0 };
            }
            // Any typing or cursor move dismisses it.
            return tr.docChanged || tr.selectionSet ? null : value;
          },
        },
        props: {
          decorations(state) {
            const ghost = ghostKey.getState(state);
            if (!ghost) return null;
            const key =
              ghost.kind === "hint"
                ? `hint-${ghost.pos}`
                : `ghost-${ghost.pos}-${ghost.index}-${ghost.items[ghost.index]}`;
            return DecorationSet.create(state.doc, [Decoration.widget(ghost.pos, () => render(ghost), { side: 1, key })]);
          },
        },
      }),
    ];
  },
});

/** A suggestion (not the hint) is showing and can be accepted. */
export function hasGhost(state: EditorState): boolean {
  return ghostKey.getState(state)?.kind === "suggest";
}

export function hasHint(state: EditorState): boolean {
  return ghostKey.getState(state)?.kind === "hint";
}

/** True when there is more than one suggestion to flip through. */
export function hasGhostChoices(state: EditorState): boolean {
  const ghost = ghostKey.getState(state);
  return ghost?.kind === "suggest" && ghost.items.length > 1;
}

export function showGhost(view: EditorView, pos: number, items: string[]) {
  if (items.length === 0 || view.state.selection.from !== pos) return;
  view.dispatch(view.state.tr.setMeta(ghostKey, { type: "show", pos, items } satisfies GhostMeta));
}

export function showHint(view: EditorView, pos: number, text: string) {
  if (view.state.selection.from !== pos) return;
  view.dispatch(view.state.tr.setMeta(ghostKey, { type: "hint", pos, text } satisfies GhostMeta));
}

export function clearGhost(view: EditorView) {
  if (!ghostKey.getState(view.state)) return;
  view.dispatch(view.state.tr.setMeta(ghostKey, { type: "clear" } satisfies GhostMeta));
}

export function stepGhost(view: EditorView, by: 1 | -1) {
  view.dispatch(view.state.tr.setMeta(ghostKey, { type: "step", by } satisfies GhostMeta));
}

/** Tab: the whole suggestion becomes real text, as if typed (one Ctrl+Z undoes it). */
export function acceptGhost(view: EditorView) {
  const ghost = ghostKey.getState(view.state);
  if (ghost?.kind !== "suggest") return;
  const text = `${ghost.items[ghost.index]!} `;
  const tr = view.state.tr.insertText(text, ghost.pos);
  tr.setSelection(TextSelection.create(tr.doc, ghost.pos + text.length));
  view.dispatch(tr.setMeta(ghostKey, { type: "clear" } satisfies GhostMeta));
}

/** Ctrl/Cmd+→: take one word and keep the rest showing. */
export function acceptGhostWord(view: EditorView) {
  const ghost = ghostKey.getState(view.state);
  if (ghost?.kind !== "suggest") return;
  const word = nextWord(ghost.items[ghost.index]!);
  if (!word) return clearGhost(view);
  const tr = view.state.tr.insertText(word, ghost.pos);
  tr.setSelection(TextSelection.create(tr.doc, ghost.pos + word.length));
  view.dispatch(tr.setMeta(ghostKey, { type: "advance", consumed: word.length } satisfies GhostMeta));
}
