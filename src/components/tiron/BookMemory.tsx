"use client";

import { useState } from "react";
import type { PartSummary, RefreshState } from "@/hooks/useStoryMemory";
import { MEMORY_ITEM_CHARS, MEMORY_LIST_MAX } from "@/lib/ai/memory";
import { copy } from "@/lib/copy";
import { addMemoryItem, editMemoryItem, removeMemoryItem } from "@/lib/db/memory";
import type { ID, MemoryItem, MemoryList, StoryMemory } from "@/lib/db/schema";
import { initialOf, splitItem, visibleItems } from "@/lib/text/memoryItem";

interface BookMemoryProps {
  bookId: ID;
  memory: StoryMemory | null;
  summaries: PartSummary[];
  refreshState: RefreshState;
  onRefresh: () => void;
  /** Near the end (T7) the open threads are a checklist under the countdown — not listed twice. */
  hideThreads?: boolean;
  /** „Osveži” waits for the book's first words. */
  hasText: boolean;
}

const REFRESH_NOTES: Partial<Record<RefreshState, string>> = {
  reading: copy.book.reading,
  unchanged: copy.book.refreshUnchanged,
  empty: copy.book.refreshEmpty,
  failed: copy.book.refreshFailed,
};

/** Likovi show this many before „još N”; Mesta a few more (they are small). */
const PEOPLE_SHOWN = 4;
const PLACES_SHOWN = 6;

const logError = (error: unknown) => console.error("Failed to save the story memory", error);

/**
 * Šta Tiron pamti (T2, POL2): Likovi with an initial, Mesta as tags, Otvorene
 * niti with a circle that closes them, chapter summaries and „Osveži”. Every
 * change saves at once.
 */
export function BookMemory({ bookId, memory, summaries, refreshState, onRefresh, hideThreads = false, hasText }: BookMemoryProps) {
  const note = REFRESH_NOTES[refreshState];
  return (
    <>
      <MemoryGroup bookId={bookId} list="characters" items={memory?.characters ?? []} />
      <MemoryGroup bookId={bookId} list="places" items={memory?.places ?? []} />
      {!hideThreads && <MemoryGroup bookId={bookId} list="openThreads" items={memory?.openThreads ?? []} />}

      {summaries.length > 0 && (
        <div className="mt-4">
          <h3 className="panel-caption">{copy.book.chapters}</h3>
          <ul className="mt-1">
            {summaries.map((part) => (
              <SummaryRow key={part.id} part={part} />
            ))}
          </ul>
        </div>
      )}

      {hasText && (
        <div className="mt-4 text-xs">
          <button
            type="button"
            title={copy.book.refreshHint}
            className="ui-button text-muted underline"
            disabled={refreshState === "reading"}
            onClick={onRefresh}
          >
            {copy.book.refresh}
          </button>
          <p aria-live="polite" className="mt-1 text-muted">
            {note}
          </p>
        </div>
      )}
    </>
  );
}

/** One list with its caption („LIKOVI · 8”), its rows and one „+ dodaj” under it. */
function MemoryGroup({ bookId, list, items }: { bookId: ID; list: MemoryList; items: MemoryItem[] }) {
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const label = copy.book.memoryLists[list];
  const limit = list === "places" ? PLACES_SHOWN : list === "characters" ? PEOPLE_SHOWN : items.length;
  const { shown, hidden } = visibleItems(items, limit, expanded);

  const adder = adding ? (
    <ItemInput
      label={copy.book.addItemLabel(label)}
      initial=""
      onDone={(text) => {
        setAdding(false);
        if (text !== null) addMemoryItem(bookId, list, text).catch(logError);
      }}
    />
  ) : null;

  const rows =
    list === "places" ? (
      <div className="mt-1 flex flex-wrap gap-1.5">
        {shown.map((item) => (
          <PlaceChip key={item.id} bookId={bookId} item={item} />
        ))}
      </div>
    ) : (
      <ul className="mt-0.5">
        {shown.map((item) =>
          list === "characters" ? (
            <PersonRow key={item.id} bookId={bookId} item={item} />
          ) : (
            <ThreadRow key={item.id} bookId={bookId} item={item} />
          ),
        )}
      </ul>
    );

  return (
    <div className="mt-4">
      <h3 className="panel-caption">{copy.book.listCaption(label, items.length)}</h3>
      {rows}
      {items.length > limit && (
        <button
          type="button"
          aria-expanded={expanded}
          className={`ui-button pt-1 text-xs text-muted hover:text-ink ${list === "characters" ? "pl-[2.375rem]" : ""}`}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? copy.book.showLess : copy.book.showMore(hidden)}
        </button>
      )}
      {adder && <div className="mt-1">{adder}</div>}
      {!adding && items.length < MEMORY_LIST_MAX && (
        <button
          type="button"
          aria-label={copy.book.addItemLabel(label)}
          className="ui-button block pt-1 text-xs text-muted hover:text-ink"
          onClick={() => setAdding(true)}
        >
          {copy.book.addItem}
        </button>
      )}
    </div>
  );
}

/** A row being edited becomes a field; Enter saves, Esc cancels, empty removes (editMemoryItem). */
function useEditing(bookId: ID, list: MemoryList, item: MemoryItem) {
  const [editing, setEditing] = useState(false);
  const field = editing ? (
    <ItemInput
      label={copy.book.editItem(item.text)}
      initial={item.text}
      onDone={(text) => {
        setEditing(false);
        if (text !== null && text !== item.text) editMemoryItem(bookId, list, item.id, text).catch(logError);
      }}
    />
  ) : null;
  return { field, edit: () => setEditing(true) };
}

/** Likovi: the initial in a circle, the name in the book's font, the rest under it. */
function PersonRow({ bookId, item }: { bookId: ID; item: MemoryItem }) {
  const { field, edit } = useEditing(bookId, "characters", item);
  if (field) return <li className="py-1">{field}</li>;
  const { name, desc } = splitItem(item.text);
  return (
    <li className="memory-row -mx-1.5 flex items-start gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-[var(--hover)]">
      {/* Every initial the same color: colors would mean something, and they don't. */}
      <span aria-hidden="true" className="grid size-7 flex-none place-items-center rounded-full bg-accent-soft text-xs font-medium text-accent">
        {initialOf(name)}
      </span>
      <button type="button" title={copy.book.editItem(item.text)} className="ui-button min-w-0 flex-1 text-left" onClick={edit}>
        <span className="block font-serif text-[0.875rem] leading-snug text-ink">{name}</span>
        {desc && <span className="block text-xs leading-snug text-muted">{desc}</span>}
      </button>
      <RemoveButton bookId={bookId} list="characters" item={item} label={name} />
    </li>
  );
}

/** Mesta: a tag with the name; the whole text in the tooltip. */
function PlaceChip({ bookId, item }: { bookId: ID; item: MemoryItem }) {
  const { field, edit } = useEditing(bookId, "places", item);
  if (field) return <div className="w-full">{field}</div>;
  const { name } = splitItem(item.text);
  return (
    <span className="memory-row memory-chip">
      <button type="button" title={item.text} aria-label={copy.book.editItem(item.text)} className="ui-button flex items-center gap-1" onClick={edit}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-[0.6875rem] text-muted">
          <path d="M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11z" />
          <circle cx="12" cy="10" r="2" />
        </svg>
        {name}
      </button>
      <RemoveButton bookId={bookId} list="places" item={item} label={name} />
    </span>
  );
}

/** Otvorene niti: the circle is a tick — it closes the thread (it leaves Tiron's memory). */
export function ThreadRow({ bookId, item }: { bookId: ID; item: MemoryItem }) {
  const { field, edit } = useEditing(bookId, "openThreads", item);
  if (field) return <li className="py-1">{field}</li>;
  return (
    <li className="flex items-start gap-2.5 py-1">
      <button
        type="button"
        aria-label={copy.book.closeThread(item.text)}
        title={copy.book.closeThreadHint}
        className="thread-check"
        onClick={() => removeMemoryItem(bookId, "openThreads", item.id).catch(logError)}
      />
      <button type="button" title={copy.book.editItem(item.text)} className="ui-button min-w-0 flex-1 text-left text-[0.78rem] leading-snug text-ink" onClick={edit}>
        {item.text}
      </button>
    </li>
  );
}

function RemoveButton({ bookId, list, item, label }: { bookId: ID; list: MemoryList; item: MemoryItem; label: string }) {
  return (
    <button
      type="button"
      aria-label={copy.book.removeItem(label)}
      title={copy.book.removeItem(label)}
      className="memory-remove ui-button px-1 text-muted"
      onClick={() => removeMemoryItem(bookId, list, item.id).catch(logError)}
    >
      ×
    </button>
  );
}

/** Enter (or leaving the field) saves, Esc cancels — Esc stays here instead of going back to the text. */
function ItemInput({ label, initial, onDone }: { label: string; initial: string; onDone: (text: string | null) => void }) {
  const [text, setText] = useState(initial);
  const [done, setDone] = useState(false);
  const finish = (value: string | null) => {
    if (done) return;
    setDone(true);
    onDone(value);
  };

  return (
    <input
      autoFocus
      aria-label={label}
      title={copy.book.itemHint}
      maxLength={MEMORY_ITEM_CHARS}
      value={text}
      className="w-full rounded border border-rule bg-transparent px-1.5 py-0.5 text-ink"
      onChange={(event) => setText(event.target.value)}
      onBlur={() => finish(text)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finish(text);
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          finish(null);
        }
      }}
    />
  );
}

/** Poglavlja: the number small on the left, the summary on one line; a click opens it all. */
function SummaryRow({ part }: { part: PartSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        title={part.label}
        className="ui-button flex w-full items-baseline gap-2 py-1 text-left text-[0.78rem]"
        onClick={() => setOpen(!open)}
      >
        <span className="min-w-[1.375rem] shrink-0 font-medium text-muted">{part.short}</span>
        <span className={`min-w-0 flex-1 text-ink ${open ? "" : "truncate"}`}>{part.summary}</span>
      </button>
    </li>
  );
}
