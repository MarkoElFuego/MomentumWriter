import { copy } from "@/lib/copy";
import { DEFAULT_LANGUAGE } from "@/lib/languages";
import { UNDO_DELETE_MS } from "@/lib/timing";
import { newId } from "./id";
import { entryPart, isAlive, listParts, newPart } from "./parts";
import { db, ORDER_STEP, type Book, type BookHeart, type ID, type Part } from "./schema";

/** A new book opens straight into its first chapter. */
export async function createBook(
  title: string = copy.structure.defaultBookTitle,
): Promise<{ book: Book; part: Part }> {
  const now = Date.now();
  const book: Book = { id: newId(), title, language: DEFAULT_LANGUAGE, createdAt: now, updatedAt: now };
  const part = newPart(book.id, "chapter", "", ORDER_STEP, now);

  await db.transaction("rw", db.books, db.parts, async () => {
    await db.books.add(book);
    await db.parts.add(part);
  });
  return { book, part };
}

/** Deleted books wait for a possible undo; everywhere else they no longer exist. */
export const isLiveBook = (book: Book) => book.deletedAt === undefined;

export async function getBook(id: ID): Promise<Book | undefined> {
  const book = await db.books.get(id);
  return book && isLiveBook(book) ? book : undefined;
}

export async function listBooks(): Promise<Book[]> {
  return (await db.books.orderBy("updatedAt").reverse().toArray()).filter(isLiveBook);
}

/** Soft delete: the book disappears at once but can be restored for UNDO_DELETE_MS. */
export async function deleteBook(id: ID, now = Date.now()): Promise<void> {
  await db.books.update(id, { deletedAt: now });
}

/** Undo: back with all its parts and notes — nothing else was touched. */
export async function restoreBook(id: ID): Promise<void> {
  await db.books
    .where("id")
    .equals(id)
    .modify((book) => {
      delete book.deletedAt;
    });
}

/** Books deleted ≥ UNDO_DELETE_MS ago go for good, with everything that belongs to them. */
export async function purgeDeletedBooks(now = Date.now()): Promise<number> {
  return db.transaction("rw", [db.books, db.parts, db.dailyStats, db.resumeState, db.storyMemory, db.sessions, db.whispers], async () => {
    const expired = (await db.books.filter((book) => book.deletedAt !== undefined && now - book.deletedAt >= UNDO_DELETE_MS).toArray()).map(
      (book) => book.id,
    );
    for (const bookId of expired) {
      await db.parts.where("bookId").equals(bookId).delete();
      await db.dailyStats.where("bookId").equals(bookId).delete();
      await db.resumeState.delete(bookId);
      await db.storyMemory.delete(bookId);
      await db.sessions.where("bookId").equals(bookId).delete();
      await db.whispers.where("bookId").equals(bookId).delete();
    }
    await db.books.bulkDelete(expired);
    return expired.length;
  });
}

export async function renameBook(id: ID, title: string): Promise<void> {
  await db.books.update(id, { title, updatedAt: Date.now() });
}

/** What the start screen and the Knjiga section change. */
export type BookDetails = Partial<Pick<Book, "title" | "heart" | "targetWords" | "genre">>;

/** Trimmed answers; blank ones are dropped, and no answers at all is no heart. */
export function cleanHeart(heart: BookHeart | undefined): BookHeart | undefined {
  const clean: BookHeart = {};
  for (const key of ["about", "ending", "why"] as const) {
    const value = heart?.[key]?.trim();
    if (value) clean[key] = value;
  }
  return Object.keys(clean).length ? clean : undefined;
}

/** The ending Tiron may lead toward — "ne znam (još)" is no ending. */
export function knownEnding(heart: BookHeart | undefined): string | undefined {
  const ending = heart?.ending?.trim();
  if (!ending || /^ne znam\b/i.test(ending)) return undefined;
  return ending.slice(0, 1000);
}

/** Undefined removes a field ("ne znam" length, no genre, no heart). */
export async function updateBook(id: ID, details: BookDetails): Promise<void> {
  const change: BookDetails = { ...details };
  if ("heart" in details) change.heart = cleanHeart(details.heart);
  if ("title" in details) change.title = details.title?.trim() || copy.structure.defaultBookTitle;
  await db.books.update(id, { ...change, updatedAt: Date.now() });
}

export async function firstPartId(bookId: ID): Promise<ID | undefined> {
  return entryPart(await listParts(bookId))?.id;
}

export async function bookWordTotal(bookId: ID): Promise<number> {
  let total = 0;
  await db.parts.where("bookId").equals(bookId).each((part) => {
    if (isAlive(part)) total += part.wordCount;
  });
  return total;
}
