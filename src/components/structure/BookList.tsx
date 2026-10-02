"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { purgeExpiredDeletes } from "@/hooks/useUndoDelete";
import { copy } from "@/lib/copy";
import { createBook, listBooks } from "@/lib/db/books";
import { bookEntryHref } from "@/lib/db/resume";
import type { Book, ID } from "@/lib/db/schema";

export function BookList() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    purgeExpiredDeletes();
    listBooks()
      .then(setBooks)
      .catch((error) => {
        console.error("Failed to list books", error);
        setFailed(true);
      });
  }, []);

  const open = async (bookId: ID) => {
    const href = await bookEntryHref(bookId);
    if (href) router.push(href);
  };

  const create = async () => {
    setBusy(true);
    try {
      const { part } = await createBook();
      router.push(`/write/${part.id}`);
    } catch (error) {
      console.error("Failed to create book", error);
      setFailed(true);
      setBusy(false);
    }
  };

  if (failed) return <p className="text-muted">{copy.library.loadFailed}</p>;
  if (!books) return null;

  return (
    <>
      {books.length === 0 ? (
        <p className="text-muted">{copy.library.empty}</p>
      ) : (
        <ul className="space-y-1">
          {books.map((book) => (
            <li key={book.id}>
              <button
                type="button"
                className="ui-button -mx-2 w-full px-2 py-2 text-left font-serif text-lg text-ink"
                onClick={() => void open(book.id)}
              >
                {book.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={busy}
        className="ui-button mt-8 border border-muted/40 px-4 py-2"
        onClick={() => void create()}
      >
        {copy.library.newBook}
      </button>
    </>
  );
}
