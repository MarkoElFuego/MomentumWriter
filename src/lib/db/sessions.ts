import { computeSignals, type ProcessSignals } from "@/lib/process/signals";
import { SESSION_GAP_MS } from "@/lib/timing";
import { newId } from "./id";
import { db, type ID, type Session } from "./schema";

/** The book's sessions, oldest first. */
export async function listSessions(bookId: ID): Promise<Session[]> {
  return (await db.sessions.where("bookId").equals(bookId).toArray()).sort((a, b) => a.startedAt - b.startedAt);
}

/**
 * One save of a part (T4) — call inside savePart's transaction. `delta` is the
 * change in the part's word count since the last save: more words count as
 * added, fewer as deleted. Close enough to tell writing from rewriting.
 */
export async function recordActivity(bookId: ID, partId: ID, delta: number, now: number): Promise<void> {
  const last = (await listSessions(bookId)).at(-1);
  const added = Math.max(delta, 0);
  const deleted = Math.max(-delta, 0);

  if (last && now - last.endedAt < SESSION_GAP_MS) {
    await db.sessions.update(last.id, {
      endedAt: now,
      wordsAdded: last.wordsAdded + added,
      wordsDeleted: last.wordsDeleted + deleted,
      partIds: last.partIds.includes(partId) ? last.partIds : [...last.partIds, partId],
    });
    return;
  }
  await db.sessions.add({
    id: newId(),
    bookId,
    partIds: [partId],
    startedAt: now,
    endedAt: now,
    wordsAdded: added,
    wordsDeleted: deleted,
    hour: new Date(now).getHours(),
  });
}

/** Process signals for the open book and part (T4) — local only, nothing is sent anywhere. */
export async function getSignals(bookId: ID, partId: ID, now = Date.now()): Promise<ProcessSignals | null> {
  const book = await db.books.get(bookId);
  if (!book) return null;
  const sessions = await listSessions(bookId);
  // Read here rather than through parts.ts, which records sessions and would import this module back.
  let totalWords = 0;
  await db.parts.where("bookId").equals(bookId).each((part) => {
    if (part.deletedAt === undefined) totalWords += part.wordCount;
  });
  return computeSignals({ sessions, partId, totalWords, targetWords: book.targetWords, now });
}
