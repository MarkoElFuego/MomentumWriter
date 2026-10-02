import type { Node as PMNode, ResolvedPos } from "@tiptap/pm/model";
import type { Command, EditorState } from "@tiptap/pm/state";
import { findWrapping, liftTarget } from "@tiptap/pm/transform";
import { isInFootnote } from "./footnotes";

export const BLOCK_STYLES = ["paragraph", "heading1", "heading2", "quote"] as const;
export type BlockStyle = (typeof BLOCK_STYLES)[number];

function inQuote($pos: ResolvedPos): boolean {
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type.name === "blockquote") return true;
  }
  return false;
}

/** The style of the block with the cursor; null where styles don't apply (footnotes, scene breaks). */
export function blockStyleAt(state: EditorState): BlockStyle | null {
  if (isInFootnote(state)) return null;
  const { $from } = state.selection;
  const block = $from.parent;
  if (block.type.name === "heading") return block.attrs.level === 2 ? "heading2" : "heading1";
  if (block.type.name !== "paragraph") return null;
  return inQuote($from) ? "quote" : "paragraph";
}

/**
 * Tekst / Naslov 1 / Naslov 2 / Citat for the selected blocks. A quote is
 * plain text inside a blockquote, so any other style leaves the quote first.
 * Alignment survives the change.
 */
export function setBlockStyle(style: BlockStyle): Command {
  return (state, dispatch) => {
    if (blockStyleAt(state) === null) return false;
    const { blockquote, paragraph, heading } = state.schema.nodes;
    if (!blockquote || !paragraph || !heading) return false;
    const tr = state.tr;

    if (style !== "quote" && inQuote(tr.selection.$from)) {
      const { $from, $to } = tr.selection;
      const range = $from.blockRange($to, (node) => node.type === blockquote);
      const target = range && liftTarget(range);
      if (range && target !== null && target !== undefined) tr.lift(range, target);
    }

    const type = style === "heading1" || style === "heading2" ? heading : paragraph;
    const level = style === "heading2" ? 2 : 1;
    const { from, to } = tr.selection;
    tr.setBlockType(from, to, type, (old: PMNode) => ({
      ...(type === heading ? { level } : {}),
      textAlign: old.attrs.textAlign ?? "left",
    }));

    if (style === "quote" && !inQuote(tr.selection.$from)) {
      const { $from, $to } = tr.selection;
      const range = $from.blockRange($to);
      const wrapping = range && findWrapping(range, blockquote);
      if (range && wrapping) tr.wrap(range, wrapping);
    }

    if (!tr.docChanged) return false;
    dispatch?.(tr.scrollIntoView());
    return true;
  };
}

const SHORTCUTS: Record<string, { digit: string; style: BlockStyle }> = {
  Digit0: { digit: "0", style: "paragraph" },
  Digit1: { digit: "1", style: "heading1" },
  Digit2: { digit: "2", style: "heading2" },
};

type ShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "getModifierState"
>;

/** Ctrl/Cmd+Alt+0/1/2 → Tekst / Naslov 1 / Naslov 2. */
export function blockStyleShortcut(event: ShortcutEvent): BlockStyle | null {
  if (!event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey)) return null;
  const shortcut = SHORTCUTS[event.code];
  if (!shortcut) return null;
  // Cmd never types; Option changes event.key on a Mac (Cmd+Opt+1 → "¡"), so the key code decides.
  if (event.metaKey) return shortcut.style;
  // Windows reports AltGr as Ctrl+Alt. When the layout types something there
  // (Serbian AltGr+1 = "~", often as a dead key), the character wins.
  if (event.getModifierState("AltGraph") || event.key !== shortcut.digit) return null;
  return shortcut.style;
}
