"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ToolbarMenu } from "@/components/editor/ToolbarMenu";
import { offerUndo, purgeExpiredDeletes, takeUndo, useUndoDelete } from "@/hooks/useUndoDelete";
import { copy } from "@/lib/copy";
import { purgeProofCache } from "@/lib/db/proofCache";
import { bookWordTotal, createBook, deleteBook, listBooks, restoreBook } from "@/lib/db/books";
import { bookEntryHref } from "@/lib/db/resume";
import type { Book, ID } from "@/lib/db/schema";
import { UndoToast } from "./UndoToast";

export function BookList() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuFor, setMenuFor] = useState<ID | null>(null);
  const [confirming, setConfirming] = useState<{ id: ID; words: number } | null>(null);
  const pendingDelete = useUndoDelete();
  const rowButtons = useRef(new Map<ID, HTMLButtonElement>());

  const load = useCallback(() => {
    listBooks()
      .then(setBooks)
      .catch((error) => {
        console.error("Failed to list books", error);
        setFailed(true);
      });
  }, []);

  useEffect(() => {
    purgeExpiredDeletes();
    purgeProofCache().catch((error) => console.error("Failed to clean the language check cache", error));
    load();
  }, [load]);

  const open = async (bookId: ID) => {
    const href = await bookEntryHref(bookId);
    if (href) router.push(href);
  };

  const create = async () => {
    setBusy(true);
    try {
      // Title and Srce knjige first (all optional), then the first chapter.
      const { book } = await createBook();
      router.push(`/start?book=${book.id}`);
    } catch (error) {
      console.error("Failed to create book", error);
      setFailed(true);
      setBusy(false);
    }
  };

  const remove = async (bookId: ID) => {
    setConfirming(null);
    try {
      await deleteBook(bookId);
      offerUndo({ kind: "book", bookId });
      setBooks((current) => current?.filter((book) => book.id !== bookId) ?? null);
    } catch (error) {
      console.error("Failed to delete the book", error);
    }
  };

  // An empty book goes without asking — "Poništi" is still there.
  const requestDelete = async (bookId: ID) => {
    setMenuFor(null);
    const words = await bookWordTotal(bookId);
    if (words === 0) return remove(bookId);
    setConfirming({ id: bookId, words });
  };

  const cancelDelete = (bookId: ID) => {
    setConfirming(null);
    rowButtons.current.get(bookId)?.focus();
  };

  const undoDelete = async () => {
    const pending = takeUndo();
    if (pending?.kind !== "book") return;
    await restoreBook(pending.bookId);
    load();
  };

  if (failed) return <p className="text-muted">{copy.library.loadFailed}</p>;
  if (!books) return null;

  return (
    <>
      {books.length === 0 ? (
        <p className="mt-16 text-muted">{copy.library.empty}</p>
      ) : (
        <>
          <h2 className="mb-4 mt-16 text-sm uppercase tracking-wider text-muted">{copy.library.title}</h2>
          <ul className="space-y-1">
            {books.map((book) => (
              <li key={book.id}>
                <div className="book-row -mx-2 flex items-center">
                  <button
                    ref={(element) => {
                      if (element) rowButtons.current.set(book.id, element);
                      else rowButtons.current.delete(book.id);
                    }}
                    type="button"
                    className="ui-button min-w-0 flex-1 px-2 py-2 text-left font-serif text-lg text-ink"
                    onClick={() => void open(book.id)}
                  >
                    {book.title}
                  </button>
                  <div className="part-menu">
                    <ToolbarMenu
                      label={copy.library.bookMenu(book.title)}
                      title={copy.library.bookMenu(book.title)}
                      align="right"
                      button={<span aria-hidden="true">⋮</span>}
                      open={menuFor === book.id}
                      onOpenChange={(open) =>
                        setMenuFor((current) => (open ? book.id : current === book.id ? null : current))
                      }
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="ui-button block w-full px-3 py-2 text-left"
                        onClick={() => void requestDelete(book.id)}
                      >
                        {copy.library.delete}
                      </button>
                    </ToolbarMenu>
                  </div>
                </div>
                {confirming?.id === book.id && (
                  <div
                    role="alertdialog"
                    aria-label={copy.library.confirmDelete(book.title, confirming.words)}
                    className="mb-2 mt-1 rounded-md border border-muted/30 p-3 text-sm"
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.stopPropagation();
                        cancelDelete(book.id);
                      }
                    }}
                  >
                    <p className="mb-2 text-ink">{copy.library.confirmDelete(book.title, confirming.words)}</p>
                    <div className="flex gap-3">
                      <button type="button" className="ui-button px-2 py-1 text-ink underline" onClick={() => void remove(book.id)}>
                        {copy.library.delete}
                      </button>
                      <button type="button" autoFocus className="ui-button px-2 py-1" onClick={() => cancelDelete(book.id)}>
                        {copy.library.cancel}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {/* With no books it is the only thing to do: the main button. */}
      <button
        type="button"
        disabled={busy}
        className={books.length === 0 ? "book-start mt-8" : "ui-button mt-8 border border-muted/40 px-4 py-2"}
        onClick={() => void create()}
      >
        {copy.library.newBook}
      </button>
      <UndoToast pending={pendingDelete?.kind === "book" ? pendingDelete : null} onUndo={() => void undoDelete()} />
    </>
  );
}
