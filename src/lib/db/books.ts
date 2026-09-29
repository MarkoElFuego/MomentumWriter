import { copy } from "@/lib/copy";
import { DEFAULT_LANGUAGE } from "@/lib/languages";
import { newId } from "./id";
import { db, ORDER_STEP, type Book, type Chapter, type ID, type Scene } from "./schema";
import { newChapter } from "./chapters";
import { newScene } from "./scenes";

export async function createBook(
  title: string = copy.structure.defaultBookTitle,
): Promise<{ book: Book; chapter: Chapter; scene: Scene }> {
  const now = Date.now();
  const book: Book = { id: newId(), title, language: DEFAULT_LANGUAGE, createdAt: now, updatedAt: now };
  const chapter = newChapter(book.id, copy.structure.chapterTitle(1), ORDER_STEP, now);
  const scene = newScene(chapter, copy.structure.sceneTitle(1), ORDER_STEP, now);

  await db.transaction("rw", db.books, db.chapters, db.scenes, async () => {
    await db.books.add(book);
    await db.chapters.add(chapter);
    await db.scenes.add(scene);
  });
  return { book, chapter, scene };
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

// Where "open book" lands until Phase 4 adds the resume position.
export async function firstSceneId(bookId: ID): Promise<ID | undefined> {
  const chapters = await db.chapters
    .where("[bookId+order]")
    .between([bookId, -Infinity], [bookId, Infinity])
    .toArray();
  for (const chapter of chapters) {
    const scene = await db.scenes
      .where("[chapterId+order]")
      .between([chapter.id, -Infinity], [chapter.id, Infinity])
      .first();
    if (scene) return scene.id;
  }
  return undefined;
}

export async function bookWordTotal(bookId: ID): Promise<number> {
  let total = 0;
  await db.scenes.where("bookId").equals(bookId).each((scene) => {
    total += scene.wordCount;
  });
  return total;
}
