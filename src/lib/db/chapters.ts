import { copy } from "@/lib/copy";
import { newId } from "./id";
import { db, ORDER_STEP, type Chapter, type ID, type Scene } from "./schema";
import { newScene } from "./scenes";

export function newChapter(bookId: ID, title: string, order: number, now: number): Chapter {
  return { id: newId(), bookId, title, order, createdAt: now, updatedAt: now };
}

export function getChapter(id: ID): Promise<Chapter | undefined> {
  return db.chapters.get(id);
}

export function listChapters(bookId: ID): Promise<Chapter[]> {
  return db.chapters
    .where("[bookId+order]")
    .between([bookId, -Infinity], [bookId, Infinity])
    .toArray();
}

// A chapter is never empty: it starts with its first scene.
export async function createChapter(bookId: ID): Promise<{ chapter: Chapter; scene: Scene }> {
  return db.transaction("rw", db.books, db.chapters, db.scenes, async () => {
    const existing = await listChapters(bookId);
    const last = existing.at(-1);
    const now = Date.now();
    const chapter = newChapter(
      bookId,
      copy.structure.chapterTitle(existing.length + 1),
      (last?.order ?? 0) + ORDER_STEP,
      now,
    );
    const scene = newScene(chapter, copy.structure.sceneTitle(1), ORDER_STEP, now);
    await db.chapters.add(chapter);
    await db.scenes.add(scene);
    await db.books.update(bookId, { updatedAt: now });
    return { chapter, scene };
  });
}

export async function renameChapter(id: ID, title: string): Promise<void> {
  await db.chapters.update(id, { title, updatedAt: Date.now() });
}
