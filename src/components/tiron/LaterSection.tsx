"use client";

import { useEffect, useState } from "react";
import type { BookLaterNote } from "@/hooks/useLaterNotes";
import { copy } from "@/lib/copy";
import { getOpenSections, setSectionOpen } from "@/lib/db/settings";

interface LaterSectionProps {
  notes: BookLaterNote[];
  onGoTo: (note: BookLaterNote) => void;
  onTickOff: (note: BookLaterNote) => void;
}

/**
 * „Za kasnije (3) ›” — every note in the book, in reading order. Only there
 * while there is a note; collapsed until the author opens it (remembered).
 */
export function LaterSection({ notes, onGoTo, onTickOff }: LaterSectionProps) {
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOpenSections()
      .then((sections) => !cancelled && setOpen(sections.includes("later")))
      .catch(() => !cancelled && setOpen(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (notes.length === 0) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    setSectionOpen("later", next).catch((error) => console.error("Failed to remember the panel section", error));
  };

  return (
    <section className="panel-section">
      <button
        type="button"
        aria-expanded={!!open}
        className="panel-heading ui-button"
        onClick={toggle}
      >
        {copy.later.sectionCount(notes.length)}
        <span aria-hidden="true" className={`book-chevron${open ? " book-chevron-open" : ""}`}>
          ›
        </span>
      </button>

      {open && (
        <ul className="mt-3 space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="flex items-start gap-2">
              <input
                type="checkbox"
                aria-label={copy.later.tickOff(note.note)}
                className="mt-1 shrink-0"
                checked={false}
                onChange={() => onTickOff(note)}
              />
              <button
                type="button"
                title={copy.later.goTo(note.text)}
                className="ui-button min-w-0 flex-1 text-left"
                onClick={() => onGoTo(note)}
              >
                <span className="block text-xs text-muted">{note.partLabel}</span>
                <span className="block text-ink">{note.note}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
