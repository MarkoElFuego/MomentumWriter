"use client";

import { useEffect, useRef, useState } from "react";
import { liveQuery } from "dexie";
import { BookDetailsFields, handleFieldKeys, type BookDetailsValue } from "@/components/book/BookDetailsFields";
import { copy } from "@/lib/copy";
import { cleanHeart, getBook } from "@/lib/db/books";
import type { ID, StoryMemory } from "@/lib/db/schema";
import { getOpenSections, setSectionOpen } from "@/lib/db/settings";
import type { PartSummary, RefreshState } from "@/hooks/useStoryMemory";
import { showsMemory } from "@/lib/text/memoryItem";
import { BookMemory, ThreadRow } from "./BookMemory";

interface BookSectionProps {
  details: BookDetailsValue;
  /** Every change is saved right away, like the chapter title. */
  onChange: (details: BookDetailsValue) => void;
  bookId: ID;
  memory: StoryMemory | null;
  summaries: PartSummary[];
  refreshState: RefreshState;
  onRefresh: () => void;
  /** Pages left near the end of the draft (T7); null → no countdown. */
  countdown: number | null;
  /** The book has at least one word — until then (and with no memories) only Srce knjige shows. */
  hasText: boolean;
}

/**
 * „Knjiga ›” in the right panel, collapsed until the author opens it (remembered
 * in Dexie). First subsection: Srce knjige — one faded line while it is empty;
 * then what Tiron remembers (T2).
 */
export function BookSection({
  details,
  onChange,
  bookId,
  memory,
  summaries,
  refreshState,
  onRefresh,
  countdown,
  hasText,
}: BookSectionProps) {
  // null until the remembered state is read — drawn collapsed meanwhile.
  const [open, setOpen] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const reading = useImportReading(bookId);
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
    <section className="panel-section">
      <button
        type="button"
        aria-expanded={!!open}
        className="panel-heading ui-button"
        onClick={toggle}
      >
        {copy.book.section}
        <span aria-hidden="true" className={`book-chevron${open ? " book-chevron-open" : ""}`}>
          ›
        </span>
      </button>
      {/* Uvoz (I3): while Tiron reads an imported book — one quiet line, open or not. */}
      {reading && (
        <p role="status" className="mt-1 text-xs text-muted">
          {copy.book.importReading(reading.done, reading.total)}
        </p>
      )}

      {open && (
        <div className="mt-3">
          <h3 className="panel-caption">{copy.book.heart}</h3>
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
          {countdown !== null && (
            <div className="mt-4">
              <p className="text-xs text-muted">{copy.book.draftCountdown(countdown)}</p>
              {(memory?.openThreads.length ?? 0) > 0 && (
                <>
                  <h3 className="panel-caption mt-3">{copy.book.listCaption(copy.book.memoryLists.openThreads, memory!.openThreads.length)}</h3>
                  <ul className="mt-0.5">
                    {memory!.openThreads.map((thread) => (
                      <ThreadRow key={thread.id} bookId={bookId} item={thread} />
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          {/* Odluka autora (POL2): a new, empty book shows only Srce knjige. */}
          {showsMemory(hasText, memory) && (
            <BookMemory
              bookId={bookId}
              memory={memory}
              summaries={summaries}
              refreshState={refreshState}
              onRefresh={onRefresh}
              hideThreads={countdown !== null}
              hasText={hasText}
            />
          )}
        </div>
      )}
    </section>
  );
}

/** How far Tiron is with an imported book, live: null when he isn't reading one. */
function useImportReading(bookId: ID): { done: number; total: number } | null {
  const [reading, setReading] = useState<{ done: number; total: number } | null>(null);
  useEffect(() => {
    const subscription = liveQuery(() => getBook(bookId)).subscribe({
      next: (book) => {
        const state = book?.importReading;
        setReading(state ? { done: state.done, total: state.partIds.length } : null);
      },
      error: (error) => console.error("Failed to follow the import reading", error),
    });
    return () => subscription.unsubscribe();
  }, [bookId]);
  return reading;
}

function HeartLine({ label, text }: { label: string; text: string }) {
  return (
    <span className="block">
      <span className="block text-xs text-muted">{label}</span>
      <span className="book-heart-line block font-serif text-ink">{text}</span>
    </span>
  );
}
