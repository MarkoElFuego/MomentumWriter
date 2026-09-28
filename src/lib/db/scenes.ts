import type { JSONContent } from "@tiptap/react";
import { copy } from "@/lib/copy";
import { ensureDailyStat } from "./dailyStats";
import { newId } from "./id";
import { db, ORDER_STEP, type Chapter, type ID, type Scene } from "./schema";

export const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export function newScene(chapter: Chapter, title: string, order: number, now: number): Scene {
  return {
    id: newId(),
    chapterId: chapter.id,
    bookId: chapter.bookId,
    title,
    order,
    content: EMPTY_DOC,
    wordCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function getScene(id: ID): Promise<Scene | undefined> {
  return db.scenes.get(id);
}

export function listScenes(chapterId: ID): Promise<Scene[]> {
  return db.scenes
    .where("[chapterId+order]")
    .between([chapterId, -Infinity], [chapterId, Infinity])
    .toArray();
}

export async function listScenesByBook(bookId: ID): Promise<Scene[]> {
  const scenes = await db.scenes.where("bookId").equals(bookId).toArray();
  return scenes.sort((a, b) => a.order - b.order);
}

export async function createScene(chapterId: ID): Promise<Scene> {
  return db.transaction("rw", db.books, db.chapters, db.scenes, async () => {
    const chapter = await db.chapters.get(chapterId);
    if (!chapter) throw new Error(`Chapter ${chapterId} not found`);
    const existing = await listScenes(chapterId);
    const last = existing.at(-1);
    const now = Date.now();
    const scene = newScene(
      chapter,
      copy.structure.sceneTitle(existing.length + 1),
      (last?.order ?? 0) + ORDER_STEP,
      now,
    );
    await db.scenes.add(scene);
    await db.books.update(chapter.bookId, { updatedAt: now });
    return scene;
  });
}

export async function renameScene(id: ID, title: string): Promise<void> {
  await db.scenes.update(id, { title, updatedAt: Date.now() });
}

export interface CursorSnapshot {
  pos: number;
  lastSentence: string;
}

/**
 * Saves scene content and keeps today's stat (and, given a cursor, the resume
 * point) in sync, all in one transaction so they can never drift from the text.
 * Returns the new word total of the whole book.
 */
export async function saveScene(
  id: ID,
  content: JSONContent,
  wordCount: number,
  date: string,
  cursor?: CursorSnapshot,
): Promise<number> {
  return db.transaction("rw", [db.scenes, db.books, db.dailyStats, db.resumeState], async () => {
    const scene = await db.scenes.get(id);
    if (!scene) throw new Error(`Scene ${id} not found`);

    let previousTotal = 0;
    await db.scenes.where("bookId").equals(scene.bookId).each((s) => {
      previousTotal += s.wordCount;
    });
    const newTotal = previousTotal - scene.wordCount + wordCount;
    const now = Date.now();

    // If the day rolled over mid-session, today starts from the pre-save total.
    await ensureDailyStat(scene.bookId, date, previousTotal);
    await db.scenes.update(id, { content, wordCount, updatedAt: now });
    await db.dailyStats.update([date, scene.bookId], { endWordTotal: newTotal });
    await db.books.update(scene.bookId, { updatedAt: now });

    if (cursor) {
      // Keep the cached open question; Resume checks it against the context hash.
      const previous = await db.resumeState.get(scene.bookId);
      await db.resumeState.put({
        ...previous,
        bookId: scene.bookId,
        sceneId: id,
        cursorPos: cursor.pos,
        lastSentence: cursor.lastSentence,
        lastWrittenAt: now,
      });
    }
    return newTotal;
  });
}
