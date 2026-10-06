import { copy } from "@/lib/copy";
import { DEFAULT_LANGUAGE } from "@/lib/languages";
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

export function getBook(id: ID): Promise<Book | undefined> {
  return db.books.get(id);
}

export function listBooks(): Promise<Book[]> {
  return db.books.orderBy("updatedAt").reverse().toArray();
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
