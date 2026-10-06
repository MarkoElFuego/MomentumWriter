"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import { firstPartId, getBook, updateBook } from "@/lib/db/books";
import type { ID } from "@/lib/db/schema";
import { BookDetailsFields, handleFieldKeys, type BookDetailsValue } from "./BookDetailsFields";

type LoadState = { kind: "loading" } | { kind: "missing" } | { kind: "failed" } | { kind: "ready"; partId: ID };

/** A new book's first screen: title and Srce knjige, everything optional (Tiron T1). */
export function StartScreen({ bookId }: { bookId: ID }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState<BookDetailsValue>({ heart: {} });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getBook(bookId), firstPartId(bookId)])
      .then(([book, partId]) => {
        if (cancelled) return;
        setState(book && partId ? { kind: "ready", partId } : { kind: "missing" });
      })
      .catch((error) => {
        console.error("Failed to open the new book", error);
        if (!cancelled) setState({ kind: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  if (state.kind === "loading") return <div className="h-dvh" />;

  if (state.kind !== "ready") {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-muted">
        <p>{state.kind === "missing" ? copy.book.notFound : copy.book.loadFailed}</p>
        <Link href="/" className="ui-button mt-4 inline-block underline">
          {copy.write.backToLibrary}
        </Link>
      </main>
    );
  }

  // Replace, so Back from the editor goes to the library, not to these questions again.
  const write = () => router.replace(`/write/${state.partId}`);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await updateBook(bookId, { ...details, ...(title.trim() ? { title } : {}) });
    } catch (error) {
      // The answers can be filled in later in the Knjiga section — never keep the author from writing.
      console.error("Failed to save the book details", error);
    }
    write();
  };

  return (
    <main className="px-6 py-16">
      <form
        className="mx-auto max-w-[66ch]"
        aria-label={copy.book.startLabel}
        onSubmit={(event) => {
          event.preventDefault();
          void start();
        }}
        onKeyDown={(event) => handleFieldKeys(event, () => void start())}
      >
        <input
          type="text"
          autoFocus
          lang="sr-Latn"
          spellCheck
          aria-label={copy.book.titleLabel}
          placeholder={copy.book.titlePlaceholder}
          className="book-field book-title-input mb-12 font-serif"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <BookDetailsFields value={details} onChange={setDetails} variant="page" />
        <div className="mt-12">
          <button
            type="submit"
            disabled={busy}
            title={copy.toolbar.withShortcut(copy.book.start, copy.book.startShortcut)}
            className="book-start"
          >
            {copy.book.start}
          </button>
          <div className="mt-4">
            <button type="button" className="ui-button text-sm underline" onClick={write}>
              {copy.book.skip}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
