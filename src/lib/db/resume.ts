import { RESUME_AFTER_MS } from "@/lib/timing";
import { entryPart, listParts } from "./parts";
import { db, type ID, type LastWin, type Part, type ResumeState } from "./schema";

export function getResumeState(bookId: ID): Promise<ResumeState | undefined> {
  return db.resumeState.get(bookId);
}

export type BookEntry = { kind: "resume" } | { kind: "write"; partId: ID };

/**
 * Where opening a book leads: after a break of more than 6 h the Resume screen,
 * otherwise straight into the part last written in. A book with no words yet
 * has nothing to come back to, so it always opens the editor.
 */
export function bookEntry(parts: Part[], state: ResumeState | undefined, now: number): BookEntry | null {
  const fallback = entryPart(parts);
  if (!fallback) return null;
  const hasText = parts.some((part) => part.wordCount > 0);
  if (!hasText || !state) return { kind: "write", partId: fallback.id };
  if (now - state.lastWrittenAt > RESUME_AFTER_MS) return { kind: "resume" };
  const last = parts.find((part) => part.id === state.partId);
  return { kind: "write", partId: (last ?? fallback).id };
}

export async function bookEntryHref(bookId: ID, now = Date.now()): Promise<string | null> {
  const [parts, state] = await Promise.all([listParts(bookId), getResumeState(bookId)]);
  const entry = bookEntry(parts, state, now);
  if (!entry) return null;
  return entry.kind === "resume" ? `/resume?book=${encodeURIComponent(bookId)}` : `/write/${entry.partId}`;
}

/** Caches the Resume question; `key` = part + context hash, so a changed text asks again. */
export async function saveOpenQuestion(bookId: ID, openQuestion: string, key: string): Promise<void> {
  await db.resumeState.update(bookId, { openQuestion, openQuestionFor: key });
}

/** The end of a session (T6): what moved and a question for today — shown on the next Resume. */
export async function saveLastWin(bookId: ID, lastWin: LastWin): Promise<void> {
  await db.resumeState.update(bookId, { lastWin });
}
