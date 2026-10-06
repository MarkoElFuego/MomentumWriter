"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { docFromJSON } from "@/components/editor/contentSchema";
import { mainTextEnd } from "@/components/editor/footnotes";
import { copy } from "@/lib/copy";
import { finishDraft, getBook } from "@/lib/db/books";
import { listDailyStats } from "@/lib/db/dailyStats";
import { listParts } from "@/lib/db/parts";
import type { Book, ID } from "@/lib/db/schema";
import { getLanguage } from "@/lib/languages";
import { draftBookends, pageCount, writingDays } from "@/lib/text/draftEnd";

interface Summary {
  book: Book;
  first: string;
  last: string;
  days: number;
  pages: number;
}

type State = { kind: "loading" } | { kind: "missing" } | { kind: "failed" } | { kind: "ready"; summary: Summary };

async function load(bookId: ID): Promise<Summary | null> {
  const book = await getBook(bookId);
  if (!book) return null;
  const [parts, stats] = await Promise.all([listParts(bookId), listDailyStats(bookId)]);
  const texts = parts.map((part) => {
    const doc = docFromJSON(part.content, book.language);
    return { kind: part.kind, text: doc.textBetween(0, mainTextEnd(doc), "\n\n") };
  });
  const total = parts.reduce((sum, part) => sum + part.wordCount, 0);
  return { book, ...draftBookends(texts), days: writingDays(stats), pages: pageCount(total) };
}

/**
 * „Označi kraj nacrta” (T7): asks once, then a quiet screen — the first and the
 * last sentence, days of writing and pages. No confetti, no animation.
 */
export function DraftEnd({ bookId, backHref }: { bookId: ID; backHref: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    load(bookId)
      .then((summary) => {
        if (cancelled) return;
        if (!summary) return setState({ kind: "missing" });
        setState({ kind: "ready", summary });
        // Coming back to a finished draft shows the screen again, without asking.
        if (summary.book.draftFinishedAt) setConfirmed(true);
      })
      .catch((error) => {
        console.error("Failed to load the end of the draft", error);
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
        <p>{state.kind === "missing" ? copy.draftEnd.notFound : copy.draftEnd.loadFailed}</p>
        <Link href="/" className="ui-button mt-4 inline-block underline">
          {copy.write.backToLibrary}
        </Link>
      </main>
    );
  }

  if (!confirmed) {
    return (
      <main
        className="mx-auto max-w-xl px-6 py-24"
        onKeyDown={(event) => {
          if (event.key === "Escape") router.push(backHref);
        }}
      >
        <h1 className="font-serif text-2xl">{copy.draftEnd.confirm}</h1>
        <p className="mt-3 text-sm text-muted">{copy.draftEnd.confirmHint}</p>
        <div className="mt-10 flex gap-4">
          <button
            type="button"
            className="ui-button border border-muted/30 px-4 py-2"
            onClick={() => {
              finishDraft(bookId)
                .then(() => setConfirmed(true))
                .catch((error) => console.error("Failed to mark the end of the draft", error));
            }}
          >
            {copy.draftEnd.mark}
          </button>
          <button type="button" autoFocus className="ui-button px-4 py-2" onClick={() => router.push(backHref)}>
            {copy.draftEnd.cancel}
          </button>
        </div>
      </main>
    );
  }

  const { book, first, last, days, pages } = state.summary;
  const { quoteOpen, quoteClose } = getLanguage(book.language).typography;
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="font-serif text-3xl">{copy.draftEnd.title}</h1>
      <dl className="mt-12 space-y-6">
        {first && (
          <div>
            <dt className="text-sm text-muted">{copy.draftEnd.first}</dt>
            <dd className="mt-1 font-serif text-lg italic">
              {quoteOpen}
              {first}
              {quoteClose}
            </dd>
          </div>
        )}
        {last && (
          <div>
            <dt className="text-sm text-muted">{copy.draftEnd.last}</dt>
            <dd className="mt-1 font-serif text-lg italic">
              {quoteOpen}
              {last}
              {quoteClose}
            </dd>
          </div>
        )}
      </dl>
      <p className="mt-12 text-sm text-muted">{copy.draftEnd.stats(days, pages)}</p>
      <button type="button" autoFocus className="ui-button mt-12 border border-muted/30 px-4 py-2" onClick={() => router.push(backHref)}>
        {copy.draftEnd.back}
      </button>
    </main>
  );
}
