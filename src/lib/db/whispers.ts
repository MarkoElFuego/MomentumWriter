import { newId } from "./id";
import { db, type ID, type Whisper } from "./schema";

/** Newest first. */
export async function listWhispers(bookId: ID): Promise<Whisper[]> {
  return (await db.whispers.where("bookId").equals(bookId).toArray()).sort((a, b) => b.createdAt - a.createdAt);
}

export type NewWhisper = Omit<Whisper, "id" | "dismissed" | "seen">;

export async function addWhisper(whisper: NewWhisper): Promise<Whisper> {
  const saved: Whisper = { ...whisper, id: newId(), dismissed: false, seen: false };
  await db.whispers.add(saved);
  return saved;
}

/** × — off the top of the panel, still in the history. */
export async function dismissWhisper(id: ID): Promise<void> {
  await db.whispers.update(id, { dismissed: true });
}

/** The author opened the panel: no more dot on T. */
export async function markWhispersSeen(bookId: ID): Promise<void> {
  await db.whispers
    .where("bookId")
    .equals(bookId)
    .filter((whisper) => !whisper.seen)
    .modify({ seen: true });
}

/** Chapter-end whispers said during this session (at most 2 per session). */
export async function chapterEndsInSession(bookId: ID, sessionId: ID): Promise<number> {
  return db.whispers
    .where("bookId")
    .equals(bookId)
    .filter((whisper) => whisper.moment === "chapterEnd" && whisper.sessionId === sessionId)
    .count();
}

/** A process pattern was already named today (at most one a day). */
export async function patternToday(bookId: ID, now: number): Promise<boolean> {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const count = await db.whispers
    .where("bookId")
    .equals(bookId)
    .filter((whisper) => whisper.moment === "pattern" && whisper.createdAt >= start.getTime())
    .count();
  return count > 0;
}

/** This session already has its closing whisper. */
export async function sessionEndSaid(bookId: ID, sessionId: ID): Promise<boolean> {
  const count = await db.whispers
    .where("bookId")
    .equals(bookId)
    .filter((whisper) => whisper.moment === "sessionEnd" && whisper.sessionId === sessionId)
    .count();
  return count > 0;
}
