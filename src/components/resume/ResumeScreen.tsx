"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { docFromJSON, restorablePos } from "@/components/editor/contentSchema";
import { requestWhisper, whisperSessionEndIfDue } from "@/components/tiron/whisper";
import { TopWhisper } from "@/components/tiron/Whispers";
import { useResumeTiron } from "@/hooks/useResumeTiron";
import { useOpenQuestion, type OpenQuestionInput } from "@/hooks/useOpenQuestion";
import { copy } from "@/lib/copy";
import { firstPartId, getBook } from "@/lib/db/books";
import { chapterNumber, listParts, partHeading } from "@/lib/db/parts";
import { getResumeState } from "@/lib/db/resume";
import type { Book, ID, Part, ResumeState } from "@/lib/db/schema";
import { getLanguage } from "@/lib/languages";
import { calendarDaysBetween } from "@/lib/stats/today";
import { extractContext } from "@/lib/text/extractContext";
import { hashText } from "@/lib/text/hash";
import { ResumePrompt } from "./ResumePrompt";

interface Ready {
  book: Book;
  part: Part;
  heading: string;
  resume: ResumeState;
  /** ~400 words before the saved cursor — what the question is about. */
  context: string;
}

type LoadState = { kind: "loading" } | { kind: "missing" } | { kind: "failed" } | { kind: "ready"; data: Ready };

async function load(bookId: ID): Promise<Ready | "missing" | { redirect: string }> {
  const [book, resume, parts] = await Promise.all([getBook(bookId), getResumeState(bookId), listParts(bookId)]);
  if (!book) return "missing";
  const part = resume && parts.find((p) => p.id === resume.partId);
  if (!resume || !part) {
    // Nothing to come back to (or that part is gone) — just open the book.
    const partId = await firstPartId(bookId);
    return partId ? { redirect: `/write/${partId}` } : "missing";
  }
  const doc = docFromJSON(part.content, book.language);
  const context = extractContext(doc, restorablePos(doc, resume.cursorPos));
  return { book, part, heading: partHeading(part, chapterNumber(parts, part.id)), resume, context };
}

export function ResumeScreen({ bookId }: { bookId: ID }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    load(bookId)
      .then((result) => {
        if (cancelled) return;
        if (result === "missing") setState({ kind: "missing" });
        else if ("redirect" in result) router.replace(result.redirect);
        else setState({ kind: "ready", data: result });
      })
      .catch((error) => {
        console.error("Failed to load Resume", error);
        if (!cancelled) setState({ kind: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, router]);

  const ready = state.kind === "ready" ? state.data : null;
  const questionInput = useMemo<OpenQuestionInput | null>(() => {
    // One question on Resume: with a small win from the last session, "Za danas" is it (T6).
    if (!ready || ready.resume.lastWin) return null;
    const { book, part, heading, resume, context } = ready;
    return {
      bookId: book.id,
      key: `${part.id}:${hashText(context)}`,
      cached:
        resume.openQuestion && resume.openQuestionFor
          ? { question: resume.openQuestion, key: resume.openQuestionFor }
          : null,
      request: { mode: "resume", context, bookTitle: book.title, chapterTitle: heading, language: book.language },
    };
  }, [ready]);
  const prompt = useOpenQuestion(questionInput);

  // Tiron (T5/T6): a session left behind by a closed tab gets its small win (and
  // a greeting made ahead), then the greeting is shown — or a pattern, or made now.
  const readyBookId = ready?.book.id ?? null;
  const tiron = useResumeTiron(readyBookId);
  useEffect(() => {
    if (!readyBookId) return;
    void whisperSessionEndIfDue(readyBookId).then(() => requestWhisper({ moment: "entry", bookId: readyBookId }));
  }, [readyBookId]);

  if (state.kind === "loading") return <div className="h-dvh" />;

  if (state.kind !== "ready") {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-muted">
        <p>{state.kind === "missing" ? copy.resume.notFound : copy.resume.loadFailed}</p>
        <Link href="/" className="ui-button mt-4 inline-block underline">
          {copy.write.backToLibrary}
        </Link>
      </main>
    );
  }

  const { book, part, resume } = state.data;
  const { quoteOpen, quoteClose } = getLanguage(book.language).typography;
  const days = calendarDaysBetween(resume.lastWrittenAt, Date.now());
  const sentence = resume.lastSentence.trim();

  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="font-serif text-3xl">{copy.resume.title}</h1>
      {sentence && (
        <>
          <p className="mt-10 text-sm text-muted">{copy.resume.stoppedAt(days)}</p>
          <blockquote className="mt-3 font-serif text-lg italic">
            {quoteOpen}
            {sentence}
            {quoteClose}
          </blockquote>
          <hr className="mt-8 border-muted/20" />
        </>
      )}
      {tiron.lastWin ? (
        <dl className="mt-10 space-y-3">
          <div>
            <dt className="text-sm text-muted">{copy.resume.lastTime}</dt>
            <dd className="mt-1 font-serif text-lg">{tiron.lastWin.progress}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">{copy.resume.today}</dt>
            <dd className="mt-1 font-serif text-lg">{tiron.lastWin.tomorrow}</dd>
          </div>
        </dl>
      ) : (
        <ResumePrompt lines={prompt.lines} loading={prompt.loading} />
      )}
      {tiron.entry && (
        <div aria-live="polite" className="mt-10">
          <TopWhisper whisper={tiron.entry} />
        </div>
      )}
      {/* Works right away — never waits for the question. */}
      <button
        type="button"
        autoFocus
        className="ui-button mt-12 border border-muted/30 px-4 py-2"
        onClick={() => router.push(`/write/${part.id}`)}
      >
        {/* After four days or more: a smaller ask, the same way in. */}
        {days >= 4 ? copy.resume.tenMinutes : copy.resume.continue}
      </button>
    </main>
  );
}
