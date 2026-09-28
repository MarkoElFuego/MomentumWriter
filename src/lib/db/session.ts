import { ensureDailyStat } from "./dailyStats";
import { db, type Book, type Chapter, type ID, type Scene } from "./schema";

export interface OpenedScene {
  scene: Scene;
  chapter: Chapter;
  book: Book;
  /** Words in the book outside this scene — lets the footer update live. */
  otherScenesTotal: number;
  startWordTotal: number;
}

/** Loads everything the editor needs and records the day's starting total. */
export async function openScene(sceneId: ID, date: string): Promise<OpenedScene | undefined> {
  return db.transaction("rw", db.books, db.chapters, db.scenes, db.dailyStats, async () => {
    const scene = await db.scenes.get(sceneId);
    if (!scene) return undefined;
    const [chapter, book] = await Promise.all([
      db.chapters.get(scene.chapterId),
      db.books.get(scene.bookId),
    ]);
    if (!chapter || !book) return undefined;

    let bookTotal = 0;
    await db.scenes.where("bookId").equals(book.id).each((s) => {
      bookTotal += s.wordCount;
    });
    const stat = await ensureDailyStat(book.id, date, bookTotal);

    return {
      scene,
      chapter,
      book,
      otherScenesTotal: bookTotal - scene.wordCount,
      startWordTotal: stat.startWordTotal,
    };
  });
}
