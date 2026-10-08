"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { copy } from "@/lib/copy";
import { bookToPrint, type PrintBook, type PrintSection } from "@/lib/db/exportBook";
import type { ID } from "@/lib/db/schema";
import "@/styles/print.css";

type State = { kind: "loading" } | { kind: "missing" } | { kind: "failed" } | { kind: "ready"; book: PrintBook };

/**
 * The book laid out for print, A5 (Faza 5). The browser makes the PDF: the
 * print dialog opens by itself once the fonts are in, and the button is there
 * if the author closed it. Nothing here edits the text.
 */
export function BookPrint({ bookId, backHref }: { bookId: ID; backHref: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const printed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    bookToPrint(bookId)
      .then((book) => {
        if (!cancelled) setState(book ? { kind: "ready", book } : { kind: "missing" });
      })
      .catch((error) => {
        console.error("Failed to load the book for print", error);
        if (!cancelled) setState({ kind: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const ready = state.kind === "ready" ? state.book : undefined;
  const printable = !!ready && (ready.sections.length > 0 || ready.titlePage !== "");

  useEffect(() => {
    if (!ready) return;
    // The browser names the PDF after the page title.
    const previous = document.title;
    document.title = ready.title;
    return () => {
      document.title = previous;
    };
  }, [ready]);

  useEffect(() => {
    if (!printable || printed.current) return;
    printed.current = true;
    // Wait for Literata, or the first pages print in the fallback font.
    void document.fonts.ready.then(() => requestAnimationFrame(() => window.print()));
  }, [printable]);

  if (state.kind === "loading") return <div className="h-dvh" />;

  const message =
    state.kind === "missing"
      ? copy.print.notFound
      : state.kind === "failed"
        ? copy.print.loadFailed
        : printable
          ? null
          : copy.print.empty;

  return (
    <>
      <div className="print-toolbar mx-auto flex max-w-[148mm] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-sm">
        <Link href={backHref} className="ui-button underline">
          {copy.print.back}
        </Link>
        {printable && (
          <>
            <button type="button" className="ui-button rounded border border-muted/40 px-3 py-1" onClick={() => window.print()}>
              {copy.print.savePdf}
            </button>
            <p className="w-full text-muted">{copy.print.hint}</p>
          </>
        )}
        {message && <p className="w-full text-muted">{message}</p>}
      </div>
      {ready && printable && <Book book={ready} />}
    </>
  );
}

// The HTML comes from partToPrintHtml, which escapes every piece of the author's text.
function Book({ book }: { book: PrintBook }) {
  return (
    <article className="print-book" lang={book.language}>
      <section className="title-page">
        <h1>{book.title}</h1>
        {book.titlePage && <div className="title-page-text" dangerouslySetInnerHTML={{ __html: book.titlePage }} />}
      </section>
      {book.sections.map((section) => (
        <Section key={section.id} section={section} />
      ))}
    </article>
  );
}

function Section({ section }: { section: PrintSection }) {
  if (section.role === "dedication") {
    return <section className="dedication" aria-label={section.title} dangerouslySetInnerHTML={{ __html: section.body }} />;
  }
  return (
    <section className="part">
      <header>
        {section.label && <p className="part-label">{section.label}</p>}
        {section.title && <h2>{section.title}</h2>}
      </header>
      <div className="part-body" dangerouslySetInnerHTML={{ __html: section.body }} />
      {section.notes.length > 0 && (
        <ol className="notes" start={section.firstNote}>
          {section.notes.map((note, i) => (
            <li key={i} id={`fn-${section.firstNote + i}`} dangerouslySetInnerHTML={{ __html: note }} />
          ))}
        </ol>
      )}
    </section>
  );
}
