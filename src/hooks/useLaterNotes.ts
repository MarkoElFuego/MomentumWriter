"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { liveQuery } from "dexie";
import { useEditorState, type Editor } from "@tiptap/react";
import { goToLaterNoteTr, laterNotesIn, removeLaterNoteTr } from "@/components/editor/laterNote";
import { chapterNumber, listParts, partLabel, removeLaterNoteFromPart } from "@/lib/db/parts";
import type { ID, Part } from "@/lib/db/schema";
import { collectLaterNotes, type LaterNoteEntry } from "@/lib/text/laterNotes";

export interface BookLaterNote extends LaterNoteEntry {
  partId: ID;
  /** "II · Kofer", "Predgovor". */
  partLabel: string;
}

// A click on a note in another part opens that part first; the note to go to
// survives the remount of the writing screen here (like useUndoDelete).
let pendingJump: string | null = null;

/**
 * Za kasnije (T3): every note in the book in reading order — the open part live
 * from the editor, the others from Dexie. Go to a note, or tick it off.
 */
export function useLaterNotes(editor: Editor | null, bookId: ID | null, partId: ID, flush: () => Promise<void>) {
  const router = useRouter();
  const [parts, setParts] = useState<Part[]>([]);

  useEffect(() => {
    if (!bookId) return;
    const subscription = liveQuery(() => listParts(bookId)).subscribe({
      next: setParts,
      error: (error) => console.error("Failed to read the notes for later", error),
    });
    return () => subscription.unsubscribe();
  }, [bookId]);

  const openNotes = useEditorState({
    editor,
    selector: ({ editor }) => (editor ? laterNotesIn(editor.state.doc) : []),
  });

  const notes = useMemo(
    () =>
      parts.flatMap((part): BookLaterNote[] => {
        const label = partLabel(part, chapterNumber(parts, part.id));
        // The saved copy of the open part lags behind autosave — the editor is the truth.
        const entries = part.id === partId ? (openNotes ?? []) : collectLaterNotes(part.content);
        return entries.map((entry) => ({ ...entry, partId: part.id, partLabel: label }));
      }),
    [parts, partId, openNotes],
  );

  // Arrived from a click in another part: put the cursor on the note.
  useEffect(() => {
    if (!editor || !pendingJump) return;
    const tr = goToLaterNoteTr(editor.state, pendingJump);
    pendingJump = null;
    if (tr) editor.view.dispatch(tr);
    editor.commands.focus();
  }, [editor]);

  const goTo = useCallback(
    async (note: BookLaterNote) => {
      if (note.partId === partId) {
        if (!editor) return;
        const tr = goToLaterNoteTr(editor.state, note.id);
        if (tr) editor.view.dispatch(tr);
        editor.commands.focus();
        return;
      }
      pendingJump = note.id;
      await flush();
      router.push(`/write/${note.partId}`);
    },
    [editor, partId, flush, router],
  );

  const tickOff = useCallback(
    (note: BookLaterNote) => {
      if (note.partId === partId) {
        // In the open text: one Ctrl+Z brings it back.
        const tr = editor && removeLaterNoteTr(editor.state, note.id);
        if (tr) editor.view.dispatch(tr);
        return;
      }
      removeLaterNoteFromPart(note.partId, note.id).catch((error) => console.error("Failed to tick off the note", error));
    },
    [editor, partId],
  );

  return { notes, goTo, tickOff };
}
