"use client";

import { copy } from "@/lib/copy";
import type { PendingDelete } from "@/hooks/useUndoDelete";

const LABELS: Record<PendingDelete["kind"], string> = {
  front: copy.structure.partDeleted,
  chapter: copy.structure.chapterDeleted,
  back: copy.structure.partDeleted,
  book: copy.library.bookDeleted,
};

/** "Poglavlje obrisano · Poništi" at the bottom of the screen while undo is possible. */
export function UndoToast({ pending, onUndo }: { pending: PendingDelete | null; onUndo: () => void }) {
  if (!pending) return null;
  return (
    <div
      role="status"
      className="undo-toast fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-md border border-muted/30 bg-paper px-4 py-2 text-sm text-muted shadow-sm"
    >
      <span>{LABELS[pending.kind]}</span>
      <span aria-hidden="true">·</span>
      <button type="button" className="ui-button text-ink underline" onClick={onUndo}>
        {copy.structure.undo}
      </button>
    </div>
  );
}
