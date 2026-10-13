import type { ImportedPart } from "@/lib/import/splitBook";
import { DEFAULT_LANGUAGE } from "@/lib/languages";
import { localDateKey } from "@/lib/stats/today";
import { copy } from "@/lib/copy";
import { newId } from "./id";
import { newPart } from "./parts";
import { db, ORDER_STEP, type Book, type ID, type Part, type PartKind } from "./schema";

// Uvoz (I1, pravilo 4): importing is not writing. One transaction — never a
// half-imported book — and nothing that counts writing: no savePart, no
// session, no ResumeState, no whisper. Today's stat starts at the imported
// total, so "reči danas" is 0 and Tiron doesn't think 80.000 words came today.

export interface BookImport {
  title: string;
  parts: ImportedPart[];
  /** „Neka Tiron pročita knjigu” (I3): every part with words, in book order, is read in the background. */
  tironReads?: boolean;
}

export async function importBook(input: BookImport, now = Date.now()): Promise<{ book: Book; firstPartId: ID }> {
  const book: Book = {
    id: newId(),
    title: input.title.trim() || copy.structure.defaultBookTitle,
    language: DEFAULT_LANGUAGE,
    createdAt: now,
    updatedAt: now,
  };
  const orders: Record<PartKind, number> = { front: 0, chapter: 0, back: 0 };
  const parts: Part[] = input.parts.map((imported) => {
    orders[imported.kind] += ORDER_STEP;
    return {
      ...newPart(book.id, imported.kind, imported.title, orders[imported.kind], now),
      content: imported.content,
      wordCount: imported.words,
    };
  });
  // A book always keeps a chapter (canDeletePart).
  if (!parts.some((part) => part.kind === "chapter")) parts.push(newPart(book.id, "chapter", "", ORDER_STEP, now));
  const total = parts.reduce((sum, part) => sum + part.wordCount, 0);
  const toRead = parts.filter((part) => part.wordCount > 0).map((part) => part.id);
  if (input.tironReads && toRead.length) book.importReading = { partIds: toRead, done: 0 };

  await db.transaction("rw", db.books, db.parts, db.dailyStats, async () => {
    await db.books.add(book);
    await db.parts.bulkAdd(parts);
    await db.dailyStats.put({ date: localDateKey(new Date(now)), bookId: book.id, startWordTotal: total, endWordTotal: total });
  });
  const firstPartId = (parts.find((part) => part.kind === "chapter") ?? parts[0]!).id;
  return { book, firstPartId };
}

/** One more part read; the last one ends the reading. Never touches updatedAt — reading is not writing. */
export async function markImportRead(bookId: ID, done: number): Promise<void> {
  await db.books
    .where("id")
    .equals(bookId)
    .modify((book) => {
      if (!book.importReading) return;
      if (done >= book.importReading.partIds.length) delete book.importReading;
      else book.importReading.done = done;
    });
}
