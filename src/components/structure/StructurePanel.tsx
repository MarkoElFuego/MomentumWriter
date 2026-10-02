"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { copy } from "@/lib/copy";
import { getBook, renameBook } from "@/lib/db/books";
import { chapterNumber, createPart, listParts, partLabel, renamePart, reorderParts } from "@/lib/db/parts";
import type { Book, ID, Part, PartKind } from "@/lib/db/schema";
import { InlineEdit } from "./InlineEdit";

interface StructurePanelProps {
  bookId: ID;
  currentPartId: ID;
  /** The open part's title as it is being typed above the text — shown without waiting for a reload. */
  currentTitle: string;
  onNavigate: (partId: ID) => void;
  onClose: () => void;
  /** Titles or order changed — the editor header may need to refresh. */
  onChanged: () => void;
  /** Move focus into the panel (when the user opened it, not when restored). */
  autoFocus: boolean;
}

type Editing = { kind: "book" | "part"; id: ID } | null;

const SECTIONS: { kind: PartKind; label: string }[] = [
  { kind: "front", label: copy.structure.frontMatter },
  { kind: "chapter", label: copy.structure.chapters },
  { kind: "back", label: copy.structure.backMatter },
];

export function StructurePanel({
  bookId,
  currentPartId,
  currentTitle,
  onNavigate,
  onClose,
  onChanged,
  autoFocus,
}: StructurePanelProps) {
  const [book, setBook] = useState<Book>();
  const [parts, setParts] = useState<Part[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [addingPart, setAddingPart] = useState(false);
  const dragged = useRef<Part | null>(null);
  const navRef = useRef<HTMLElement>(null);
  // Reordering moves the button in the DOM, which drops its focus; put it back.
  const [refocusId, setRefocusId] = useState<ID | null>(null);
  const currentRef = useRef<HTMLButtonElement>(null);
  const focusedOnOpen = useRef(false);

  const reload = useCallback(async () => {
    const [b, p] = await Promise.all([getBook(bookId), listParts(bookId)]);
    setBook(b);
    setParts(p);
  }, [bookId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Keyboard users land on the current part when the panel opens.
  useEffect(() => {
    if (autoFocus && !focusedOnOpen.current && currentRef.current) {
      currentRef.current.focus();
      focusedOnOpen.current = true;
    }
  }, [parts, autoFocus]);

  useEffect(() => {
    if (!refocusId) return;
    navRef.current?.querySelector<HTMLButtonElement>(`[data-part-id="${refocusId}"]`)?.focus();
    setRefocusId(null);
  }, [parts, refocusId]);

  const rename = async (fn: (id: ID, title: string) => Promise<void>, id: ID, title: string) => {
    setEditing(null);
    await fn(id, title);
    await reload();
    onChanged();
  };

  const add = async (kind: PartKind, title?: string) => {
    setAddingPart(false);
    const part = await createPart(bookId, kind, title);
    await reload();
    onNavigate(part.id);
  };

  // Parts only move within their own kind; chapters renumber themselves.
  const moveTo = async (part: Part, target: Part) => {
    if (part.id === target.id || part.kind !== target.kind) return;
    const ids = parts.filter((p) => p.kind === part.kind).map((p) => p.id);
    const to = ids.indexOf(target.id);
    ids.splice(ids.indexOf(part.id), 1);
    ids.splice(to, 0, part.id);
    await reorderParts(ids);
    await reload();
    setRefocusId(part.id);
    onChanged();
  };

  const moveBy = (part: Part, delta: -1 | 1) => {
    const group = parts.filter((p) => p.kind === part.kind);
    const target = group[group.indexOf(part) + delta];
    if (target) void moveTo(part, target);
  };

  const isEditing = (kind: NonNullable<Editing>["kind"], id: ID) =>
    editing?.kind === kind && editing.id === id;

  return (
    <nav
      ref={navRef}
      aria-label={copy.structure.panelLabel}
      className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-muted/20 px-3 py-4 text-sm"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        {book && isEditing("book", book.id) ? (
          <InlineEdit
            value={book.title}
            onSave={(title) => void rename(renameBook, book.id, title)}
            onCancel={() => setEditing(null)}
            className="font-serif"
          />
        ) : (
          <button
            type="button"
            title={copy.structure.renameHint}
            className="ui-button truncate px-1 text-left font-serif text-ink"
            onDoubleClick={() => book && setEditing({ kind: "book", id: book.id })}
            onKeyDown={(event) => {
              if (event.key === "F2" && book) {
                event.preventDefault();
                setEditing({ kind: "book", id: book.id });
              }
            }}
          >
            {book?.title}
          </button>
        )}
        <button
          type="button"
          aria-label={copy.structure.close}
          className="ui-button px-1"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {SECTIONS.map(({ kind, label }) => {
        const group = parts.filter((p) => p.kind === kind);
        if (group.length === 0 && kind !== "chapter") return null;
        return (
          <section key={kind} className="mb-4">
            <h2 className="px-1 pb-1 text-xs uppercase tracking-wider">{label}</h2>
            <ol className="space-y-0.5">
              {group.map((part) => {
                const isCurrent = part.id === currentPartId;
                const editingThis = isEditing("part", part.id);
                return (
                  <li
                    key={part.id}
                    draggable={!editingThis}
                    onDragStart={(event) => {
                      dragged.current = part;
                      event.dataTransfer.effectAllowed = "move";
                      // Firefox starts a drag only when some data is set.
                      event.dataTransfer.setData("text/plain", part.id);
                    }}
                    onDragOver={(event) => {
                      if (dragged.current?.kind === kind) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragged.current) void moveTo(dragged.current, part);
                      dragged.current = null;
                    }}
                    onDragEnd={() => {
                      dragged.current = null;
                    }}
                  >
                    {editingThis ? (
                      <InlineEdit
                        value={isCurrent ? currentTitle : part.title}
                        allowEmpty={kind === "chapter"}
                        onSave={(title) => void rename(renamePart, part.id, title)}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <button
                        ref={isCurrent ? currentRef : undefined}
                        type="button"
                        data-part-id={part.id}
                        title={copy.structure.renameHint}
                        aria-current={isCurrent ? "page" : undefined}
                        aria-keyshortcuts="F2 Alt+ArrowUp Alt+ArrowDown"
                        className={`ui-button w-full truncate px-1 py-1 text-left ${isCurrent ? "text-ink" : ""}`}
                        onClick={() => {
                          if (!isCurrent) onNavigate(part.id);
                        }}
                        onDoubleClick={() => setEditing({ kind: "part", id: part.id })}
                        onKeyDown={(event) => {
                          if (event.key === "F2") {
                            event.preventDefault();
                            setEditing({ kind: "part", id: part.id });
                          } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
                            event.preventDefault();
                            moveBy(part, event.key === "ArrowUp" ? -1 : 1);
                          }
                        }}
                      >
                        {partLabel(isCurrent ? { ...part, title: currentTitle } : part, chapterNumber(parts, part.id))}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
            {kind === "chapter" && (
              <button
                type="button"
                className="ui-button mt-1 px-1 text-xs"
                onClick={() => void add("chapter")}
              >
                {copy.structure.addChapter}
              </button>
            )}
          </section>
        );
      })}

      <button
        type="button"
        aria-expanded={addingPart}
        className="ui-button self-start px-1 text-xs"
        onClick={() => setAddingPart((open) => !open)}
      >
        {copy.structure.addPart}
      </button>
      {addingPart && (
        <ul className="mt-1 space-y-0.5 pl-3 text-xs">
          {(["front", "back"] as const).flatMap((kind) =>
            copy.structure.partPresets[kind].map((title) => (
              <li key={title}>
                <button
                  type="button"
                  className="ui-button px-1 py-0.5"
                  onClick={() => void add(kind, title)}
                >
                  {title}
                </button>
              </li>
            )),
          )}
        </ul>
      )}
    </nav>
  );
}
