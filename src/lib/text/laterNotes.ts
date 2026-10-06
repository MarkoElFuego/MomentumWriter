import type { JSONContent } from "@tiptap/react";

// Beleške za kasnije (T3) read straight from a part's saved JSON — for the
// parts that are not open in the editor.

const LATER_NOTE = "laterNote";

export interface LaterNoteEntry {
  id: string;
  note: string;
  createdAt: number;
  /** The marked text (all its parts), for the tooltip in the panel. */
  text: string;
}

function walk(node: JSONContent, visit: (node: JSONContent) => void) {
  visit(node);
  node.content?.forEach((child) => walk(child, visit));
}

/** Notes in reading order; one entry per note even when Enter split it in two. */
export function collectLaterNotes(content: JSONContent): LaterNoteEntry[] {
  const notes = new Map<string, LaterNoteEntry>();
  walk(content, (node) => {
    const mark = node.marks?.find((m) => m.type === LATER_NOTE);
    const id = mark?.attrs?.id as string | undefined;
    if (!mark || !id) return;
    const existing = notes.get(id);
    if (existing) {
      existing.text += node.text ?? "";
      return;
    }
    notes.set(id, {
      id,
      note: String(mark.attrs?.note ?? ""),
      createdAt: Number(mark.attrs?.createdAt ?? 0),
      text: node.text ?? "",
    });
  });
  return [...notes.values()];
}

/** The same content without this note's mark — the text and every other mark stay. */
export function stripLaterNote(content: JSONContent, id: string): JSONContent {
  const marks = content.marks?.filter((mark) => !(mark.type === LATER_NOTE && mark.attrs?.id === id));
  const next: JSONContent = { ...content };
  if (content.marks) {
    if (marks?.length) next.marks = marks;
    else delete next.marks;
  }
  if (content.content) next.content = content.content.map((child) => stripLaterNote(child, id));
  return next;
}
