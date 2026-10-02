"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { copy } from "@/lib/copy";
import { getBook, renameBook } from "@/lib/db/books";
import { ToolbarMenu } from "@/components/editor/ToolbarMenu";
import {
  canDeletePart,
  chapterNumber,
  createPart,
  listParts,
  partLabel,
  renamePart,
  reorderParts,
} from "@/lib/db/parts";
import type { Book, ID, Part, PartKind } from "@/lib/db/schema";
import { InlineEdit } from "./InlineEdit";
import { SortableParts } from "./SortableParts";

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
  /** Soft-deletes the part (the writing screen offers undo and moves on if it was open). */
  onDelete: (part: Part) => Promise<void>;
  /** Bumped when parts changed outside the panel (undo) — reload the list. */
  reloadKey: number;
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
  onDelete,
  reloadKey,
}: StructurePanelProps) {
  const [book, setBook] = useState<Book>();
  const [parts, setParts] = useState<Part[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [addingPart, setAddingPart] = useState(false);
  const [menuFor, setMenuFor] = useState<ID | null>(null);
  const [confirming, setConfirming] = useState<ID | null>(null);
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
  }, [reload, reloadKey]);

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
    const group = parts.filter((p) => p.kind === part.kind);
    const to = group.indexOf(target);
    group.splice(group.indexOf(part), 1);
    group.splice(to, 0, part);
    // Show the new order right away, so the dropped row doesn't jump back first.
    let next = 0;
    setParts(parts.map((p) => (p.kind === part.kind ? group[next++]! : p)));
    await reorderParts(group.map((p) => p.id));
    await reload();
    setRefocusId(part.id);
    onChanged();
  };

  const remove = async (part: Part) => {
    setConfirming(null);
    // Focus lands on a neighbour in the list instead of getting lost.
    const index = parts.indexOf(part);
    const neighbour = parts[index - 1] ?? parts[index + 1];
    await onDelete(part);
    await reload();
    if (neighbour) setRefocusId(neighbour.id);
  };

  const requestDelete = (part: Part) => {
    setMenuFor(null);
    if (!canDeletePart(parts, part)) return;
    // Nothing written yet — nothing to lose, no question.
    if (part.wordCount === 0) void remove(part);
    else setConfirming(part.id);
  };

  const labelOf = (part: Part) =>
    partLabel(part.id === currentPartId ? { ...part, title: currentTitle } : part, chapterNumber(parts, part.id));

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
            <SortableParts
              items={group}
              disabled={editing !== null}
              label={(part) => labelOf(part)}
              onMove={(part, target) => void moveTo(part, target)}
              renderItem={(part) => {
                const isCurrent = part.id === currentPartId;
                const name = labelOf(part);
                const deletable = canDeletePart(parts, part);
                if (isEditing("part", part.id)) {
                  return (
                    <InlineEdit
                      value={isCurrent ? currentTitle : part.title}
                      allowEmpty={kind === "chapter"}
                      onSave={(title) => void rename(renamePart, part.id, title)}
                      onCancel={() => setEditing(null)}
                    />
                  );
                }
                return (
                  <>
                    <div className="flex items-center gap-1">
                      <button
                        ref={isCurrent ? currentRef : undefined}
                        type="button"
                        data-part-id={part.id}
                        title={copy.structure.renameHint}
                        aria-current={isCurrent ? "page" : undefined}
                        aria-keyshortcuts="F2"
                        className={`ui-button min-w-0 flex-1 truncate px-1 py-1 text-left ${
                          isCurrent ? "font-semibold text-ink" : ""
                        }`}
                        onClick={() => {
                          if (!isCurrent) onNavigate(part.id);
                        }}
                        onDoubleClick={() => setEditing({ kind: "part", id: part.id })}
                        onKeyDown={(event) => {
                          if (event.key === "F2") {
                            event.preventDefault();
                            setEditing({ kind: "part", id: part.id });
                          }
                        }}
                      >
                        {/* Keyed by the number: a new one fades in instead of jumping (typing a title doesn't). */}
                        <span key={chapterNumber(parts, part.id) ?? "none"} className="part-label">
                          {name}
                        </span>
                      </button>
                      <div className="part-menu">
                        <ToolbarMenu
                          label={copy.structure.partMenu(name)}
                          title={copy.structure.partMenu(name)}
                          align="right"
                          button={<span aria-hidden="true">⋮</span>}
                          open={menuFor === part.id}
                          onOpenChange={(open) =>
                            setMenuFor((current) => (open ? part.id : current === part.id ? null : current))
                          }
                        >
                          <button
                            type="button"
                            role="menuitem"
                            className="ui-button block w-full px-3 py-2 text-left"
                            onClick={() => {
                              setMenuFor(null);
                              setEditing({ kind: "part", id: part.id });
                            }}
                          >
                            {copy.structure.rename}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            // aria-disabled, not disabled: the tooltip has to explain why.
                            aria-disabled={!deletable}
                            title={deletable ? undefined : copy.structure.cantDeleteLast}
                            className={`ui-button block w-full px-3 py-2 text-left${deletable ? "" : " opacity-50"}`}
                            onClick={() => requestDelete(part)}
                          >
                            {copy.structure.delete}
                          </button>
                        </ToolbarMenu>
                      </div>
                    </div>
                    {confirming === part.id && (
                      <div
                        role="alertdialog"
                        aria-label={copy.structure.confirmDelete(name, part.wordCount)}
                        className="mx-1 mb-1 mt-0.5 rounded-md border border-muted/30 p-2 text-xs"
                        // A click or drag here is not a drag of the row.
                        onPointerDown={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.stopPropagation();
                            setConfirming(null);
                            setRefocusId(part.id);
                          }
                        }}
                      >
                        <p className="mb-2 text-ink">{copy.structure.confirmDelete(name, part.wordCount)}</p>
                        <div className="flex gap-2">
                          <button type="button" className="ui-button px-2 py-1 text-ink underline" onClick={() => void remove(part)}>
                            {copy.structure.delete}
                          </button>
                          <button
                            type="button"
                            autoFocus
                            className="ui-button px-2 py-1"
                            onClick={() => {
                              setConfirming(null);
                              setRefocusId(part.id);
                            }}
                          >
                            {copy.structure.cancel}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              }}
            />
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
