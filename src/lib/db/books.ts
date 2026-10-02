import { copy } from "@/lib/copy";
import { DEFAULT_LANGUAGE } from "@/lib/languages";
import { newId } from "./id";
import { entryPart, isAlive, listParts, newPart } from "./parts";
import { db, ORDER_STEP, type Book, type ID, type Part } from "./schema";

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

export function getBook(id: ID): Promise<Book | undefined> {
  return db.books.get(id);
}

export function listBooks(): Promise<Book[]> {
  return db.books.orderBy("updatedAt").reverse().toArray();
}

export async function renameBook(id: ID, title: string): Promise<void> {
  await db.books.update(id, { title, updatedAt: Date.now() });
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
