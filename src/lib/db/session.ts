import { ensureDailyStat } from "./dailyStats";
import { chapterNumber, isAlive } from "./parts";
import { db, type Book, type ID, type Part } from "./schema";

export interface OpenedPart {
  part: Part;
  book: Book;
  /** 1-based for chapters, undefined for front/back matter. */
  chapterNumber: number | undefined;
  /** Words in the book outside this part — lets the footer update live. */
  otherPartsTotal: number;
  startWordTotal: number;
}

/** Loads everything the editor needs and records the day's starting total. */
export async function openPart(partId: ID, date: string): Promise<OpenedPart | undefined> {
  return db.transaction("rw", [db.books, db.parts, db.dailyStats], async () => {
    const part = await db.parts.get(partId);
    if (!part || !isAlive(part)) return undefined;
    const book = await db.books.get(part.bookId);
    // A book waiting for "Poništi" is gone for the editor too.
    if (!book || book.deletedAt !== undefined) return undefined;

    const parts = (await db.parts.where("bookId").equals(book.id).toArray()).filter(isAlive);
    const bookTotal = parts.reduce((sum, p) => sum + p.wordCount, 0);
    const stat = await ensureDailyStat(book.id, date, bookTotal);

    return {
      part,
      book,
      chapterNumber: chapterNumber(parts, part.id),
      otherPartsTotal: bookTotal - part.wordCount,
      startWordTotal: stat.startWordTotal,
    };
  });
}
