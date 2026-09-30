import type { JSONContent } from "@tiptap/react";
import { copy } from "@/lib/copy";
import { ensureDailyStat } from "./dailyStats";
import { EMPTY_DOC } from "./doc";
import { newId } from "./id";
import { db, ORDER_STEP, type ID, type Part, type PartKind } from "./schema";

const KIND_RANK: Record<PartKind, number> = { front: 0, chapter: 1, back: 2 };

/** Book order: front matter, chapters, back matter — each by its own order. */
export function sortParts(parts: Part[]): Part[] {
  return [...parts].sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.order - b.order);
}

/** 1-based chapter number, or undefined for front/back matter. */
export function chapterNumber(parts: Part[], id: ID): number | undefined {
  const chapters = sortParts(parts).filter((p) => p.kind === "chapter");
  const index = chapters.findIndex((p) => p.id === id);
  return index === -1 ? undefined : index + 1;
}

export function newPart(bookId: ID, kind: PartKind, title: string, order: number, now: number): Part {
  return {
    id: newId(),
    bookId,
    kind,
    title,
    order,
    content: EMPTY_DOC,
    wordCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function getPart(id: ID): Promise<Part | undefined> {
  return db.parts.get(id);
}

export async function listParts(bookId: ID): Promise<Part[]> {
  return sortParts(await db.parts.where("bookId").equals(bookId).toArray());
}

/** Appends a part at the end of its kind. */
export async function createPart(bookId: ID, kind: PartKind, title = ""): Promise<Part> {
  return db.transaction("rw", db.books, db.parts, async () => {
    const sameKind = (await listParts(bookId)).filter((p) => p.kind === kind);
    const now = Date.now();
    const part = newPart(bookId, kind, title, (sameKind.at(-1)?.order ?? 0) + ORDER_STEP, now);
    await db.parts.add(part);
    await db.books.update(bookId, { updatedAt: now });
    return part;
  });
}

export async function renamePart(id: ID, title: string): Promise<void> {
  await db.parts.update(id, { title, updatedAt: Date.now() });
}

/** Gives the listed parts (one kind, in their new order) fresh evenly spaced orders. */
export async function reorderParts(ids: ID[]): Promise<void> {
  await db.transaction("rw", db.parts, async () => {
    await Promise.all(ids.map((id, i) => db.parts.update(id, { order: (i + 1) * ORDER_STEP })));
  });
}

export interface CursorSnapshot {
  pos: number;
  lastSentence: string;
}

/**
 * Saves part content and keeps today's stat (and, given a cursor, the resume
 * point) in sync, all in one transaction so they can never drift from the text.
 * Returns the new word total of the whole book.
 */
export async function savePart(
  id: ID,
  content: JSONContent,
  wordCount: number,
  date: string,
  cursor?: CursorSnapshot,
): Promise<number> {
  return db.transaction("rw", [db.parts, db.books, db.dailyStats, db.resumeState], async () => {
    const part = await db.parts.get(id);
    if (!part) throw new Error(`Part ${id} not found`);

    let previousTotal = 0;
    await db.parts.where("bookId").equals(part.bookId).each((p) => {
      previousTotal += p.wordCount;
    });
    const newTotal = previousTotal - part.wordCount + wordCount;
    const now = Date.now();

    // If the day rolled over mid-session, today starts from the pre-save total.
    await ensureDailyStat(part.bookId, date, previousTotal);
    await db.parts.update(id, { content, wordCount, updatedAt: now });
    await db.dailyStats.update([date, part.bookId], { endWordTotal: newTotal });
    await db.books.update(part.bookId, { updatedAt: now });

    if (cursor) {
      // Keep the cached open question; Resume checks it against the context hash.
      const previous = await db.resumeState.get(part.bookId);
      await db.resumeState.put({
        ...previous,
        bookId: part.bookId,
        partId: id,
        cursorPos: cursor.pos,
        lastSentence: cursor.lastSentence,
        lastWrittenAt: now,
      });
    }
    return newTotal;
  });
}

/** "Poglavlje IV · Dolazak" in the header; front/back matter show their own title. */
export function partHeading(part: Part, number: number | undefined): string {
  if (part.kind === "chapter" && number) return copy.structure.chapterHeading(number, part.title);
  return part.title || copy.structure.untitledPart;
}

/** Shorter form for the structure panel: "IV · Dolazak". */
export function partLabel(part: Part, number: number | undefined): string {
  if (part.kind === "chapter" && number) return copy.structure.chapterLabel(number, part.title);
  return part.title || copy.structure.untitledPart;
}
