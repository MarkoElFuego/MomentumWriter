"use client";

import { useEffect, useRef, useState } from "react";
import { BookDetailsFields, handleFieldKeys, type BookDetailsValue } from "@/components/book/BookDetailsFields";
import { copy } from "@/lib/copy";
import { cleanHeart } from "@/lib/db/books";
import { getOpenSections, setSectionOpen } from "@/lib/db/settings";

interface BookSectionProps {
  details: BookDetailsValue;
  /** Every change is saved right away, like the chapter title. */
  onChange: (details: BookDetailsValue) => void;
}

/**
 * „Knjiga ›” in the right panel, collapsed until the author opens it (remembered
 * in Dexie). First subsection: Srce knjige — one faded line while it is empty.
 */
export function BookSection({ details, onChange }: BookSectionProps) {
  // null until the remembered state is read — drawn collapsed meanwhile.
  const [open, setOpen] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const summaryRef = useRef<HTMLButtonElement>(null);
  const backToSummary = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getOpenSections()
      .then((sections) => !cancelled && setOpen(sections.includes("book")))
      .catch(() => !cancelled && setOpen(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (editing || !backToSummary.current) return;
    backToSummary.current = false;
    summaryRef.current?.focus();
  }, [editing]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    setSectionOpen("book", next).catch((error) => console.error("Failed to remember the panel section", error));
  };

  const finish = () => {
    backToSummary.current = true;
    setEditing(false);
  };

  const heart = cleanHeart(details.heart);
  const meta = [
    details.genre && copy.book.genres[details.genre],
    details.targetWords && copy.book.lengths[details.targetWords],
  ].filter(Boolean);
  const empty = !heart && meta.length === 0;

  return (
    <section className="mt-8 border-t border-muted/20 pt-4">
      <button
        type="button"
        aria-expanded={!!open}
        className="ui-button flex w-full items-center gap-2 text-left text-xs uppercase tracking-wider"
        onClick={toggle}
      >
        {copy.book.section}
        <span aria-hidden="true" className={`book-chevron${open ? " book-chevron-open" : ""}`}>
          ›
        </span>
      </button>

      {open && (
        <div className="mt-3">
          <h3 className="text-xs text-muted">{copy.book.heart}</h3>
          {editing ? (
            <div
              className="mt-2"
              onKeyDown={(event) => {
                // Esc ends editing first; the next Esc goes back to the text.
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  finish();
                  return;
                }
                handleFieldKeys(event, finish);
              }}
            >
              <BookDetailsFields value={details} onChange={onChange} variant="panel" autoFocus />
              <button type="button" className="ui-button mt-4 text-xs underline" onClick={finish}>
                {copy.book.done}
              </button>
            </div>
          ) : (
            <button
              ref={summaryRef}
              type="button"
              title={empty ? undefined : copy.book.editHeart}
              className="ui-button mt-1 block w-full text-left"
              onClick={() => setEditing(true)}
            >
              {empty ? (
                <span className="text-muted">{copy.book.addHeart}</span>
              ) : (
                <span className="block space-y-2">
                  {heart?.about && <HeartLine label={copy.book.aboutShort} text={heart.about} />}
                  {heart?.ending && <HeartLine label={copy.book.endingShort} text={heart.ending} />}
                  {heart?.why && <HeartLine label={copy.book.whyShort} text={heart.why} />}
                  {meta.length > 0 && <span className="block text-xs text-muted">{meta.join(" · ")}</span>}
                </span>
              )}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function HeartLine({ label, text }: { label: string; text: string }) {
  return (
    <span className="block">
      <span className="block text-xs text-muted">{label}</span>
      <span className="book-heart-line block font-serif text-ink">{text}</span>
    </span>
  );
}
