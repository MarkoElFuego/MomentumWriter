"use client";

import { useState } from "react";
import type { PartSummary, RefreshState } from "@/hooks/useStoryMemory";
import { MEMORY_ITEM_CHARS, MEMORY_LIST_MAX } from "@/lib/ai/memory";
import { copy } from "@/lib/copy";
import { addMemoryItem, editMemoryItem, removeMemoryItem } from "@/lib/db/memory";
import { MEMORY_LISTS, type ID, type MemoryItem, type MemoryList, type StoryMemory } from "@/lib/db/schema";

interface BookMemoryProps {
  bookId: ID;
  memory: StoryMemory | null;
  summaries: PartSummary[];
  refreshState: RefreshState;
  onRefresh: () => void;
}

const REFRESH_NOTES: Partial<Record<RefreshState, string>> = {
  reading: copy.book.reading,
  unchanged: copy.book.refreshUnchanged,
  empty: copy.book.refreshEmpty,
  failed: copy.book.refreshFailed,
};

const logError = (error: unknown) => console.error("Failed to save the story memory", error);

/** Šta Tiron pamti: Likovi, Mesta, Otvorene niti, sažeci poglavlja and „Osveži”. Changes save at once. */
export function BookMemory({ bookId, memory, summaries, refreshState, onRefresh }: BookMemoryProps) {
  const note = REFRESH_NOTES[refreshState];
  return (
    <>
      {MEMORY_LISTS.map((list) => (
        <MemoryListView key={list} bookId={bookId} list={list} items={memory?.[list] ?? []} />
      ))}

      {summaries.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs text-muted">{copy.book.chapters}</h3>
          <ul className="mt-1 space-y-1">
            {summaries.map((part) => (
              <SummaryRow key={part.id} part={part} />
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 text-xs">
        <button
          type="button"
          title={copy.book.refreshHint}
          className="ui-button underline"
          disabled={refreshState === "reading"}
          onClick={onRefresh}
        >
          {copy.book.refresh}
        </button>
        <p aria-live="polite" className="mt-1 text-muted">
          {note}
        </p>
      </div>
    </>
  );
}

function MemoryListView({ bookId, list, items }: { bookId: ID; list: MemoryList; items: MemoryItem[] }) {
  const [adding, setAdding] = useState(false);
  const label = copy.book.memoryLists[list];

  return (
    <div className="mt-4">
      <h3 className="text-xs text-muted">{label}</h3>
      <ul className="mt-1 space-y-0.5">
        {items.map((item) => (
          <MemoryRow key={item.id} bookId={bookId} list={list} item={item} />
        ))}
        {adding && (
          <li>
            <ItemInput
              label={copy.book.addItemLabel(label)}
              initial=""
              onDone={(text) => {
                setAdding(false);
                if (text !== null) addMemoryItem(bookId, list, text).catch(logError);
              }}
            />
          </li>
        )}
      </ul>
      {!adding && items.length < MEMORY_LIST_MAX && (
        <button
          type="button"
          aria-label={copy.book.addItemLabel(label)}
          className="ui-button mt-0.5 text-xs text-muted"
          onClick={() => setAdding(true)}
        >
          {copy.book.addItem}
        </button>
      )}
    </div>
  );
}

function MemoryRow({ bookId, list, item }: { bookId: ID; list: MemoryList; item: MemoryItem }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <ItemInput
          label={copy.book.editItem(item.text)}
          initial={item.text}
          onDone={(text) => {
            setEditing(false);
            if (text !== null && text !== item.text) editMemoryItem(bookId, list, item.id, text).catch(logError);
          }}
        />
      </li>
    );
  }

  return (
    <li className="memory-row flex items-start gap-1">
      <button
        type="button"
        title={copy.book.editItem(item.text)}
        className="ui-button min-w-0 flex-1 text-left text-ink"
        onClick={() => setEditing(true)}
      >
        {item.text}
      </button>
      <button
        type="button"
        aria-label={copy.book.removeItem(item.text)}
        className="memory-remove ui-button px-1 text-muted"
        onClick={() => removeMemoryItem(bookId, list, item.id).catch(logError)}
      >
        ×
      </button>
    </li>
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
      className="w-full rounded border border-muted/30 bg-transparent px-1 py-0.5 text-ink"
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

function SummaryRow({ part }: { part: PartSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        className="ui-button block w-full text-left text-ink"
        onClick={() => setOpen(!open)}
      >
        {part.label}
      </button>
      {open && <p className="mt-0.5 text-xs text-muted">{part.summary}</p>}
    </li>
  );
}
