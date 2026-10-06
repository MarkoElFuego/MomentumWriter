"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "@/lib/copy";
import { LATER_NOTE_CHARS } from "./laterNote";
import { placeAt, type PopoverAnchor } from "./ProofPopover";

interface LaterNotePopoverProps {
  anchor: PopoverAnchor;
  /** An existing note's text when the cursor is already in one. */
  initial: string;
  onSave: (note: string) => void;
  /** Esc, empty Enter or a click elsewhere — nothing changes. */
  onCancel: () => void;
}

/** „Šta ovde kasnije?” under the marked word: Enter saves, Esc goes back to the text. */
export function LaterNotePopover({ anchor, initial, onSave, onCancel }: LaterNotePopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState(initial);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onCancel();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onCancel]);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={copy.later.prompt}
      style={placeAt(anchor)}
      className="z-30 w-64 rounded-md border border-muted/30 bg-paper p-2 text-sm shadow-sm"
    >
      <input
        autoFocus
        aria-label={copy.later.prompt}
        placeholder={copy.later.prompt}
        title={copy.later.hint}
        maxLength={LATER_NOTE_CHARS}
        value={note}
        className="w-full bg-transparent px-1 py-0.5 text-ink outline-none placeholder:text-muted"
        onChange={(event) => setNote(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (note.trim()) onSave(note);
            else onCancel();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
        }}
      />
    </div>
  );
}
