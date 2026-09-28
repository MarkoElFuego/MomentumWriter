import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookWordTotal, createBook, firstSceneId, getBook, listBooks, renameBook } from "./books";
import { createChapter, listChapters, renameChapter } from "./chapters";
import { getDailyStat } from "./dailyStats";
import { db } from "./schema";
import { createScene, getScene, listScenes, listScenesByBook, renameScene, saveScene } from "./scenes";
import { openScene } from "./session";

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

beforeEach(async () => {
  // Monotonic clock so "most recently updated" never ties within one millisecond.
  let tick = 1_000;
  vi.spyOn(Date, "now").mockImplementation(() => ++tick);
  await db.delete();
  await db.open();
});

describe("books", () => {
  it("creates a book with Poglavlje I and Scena 1", async () => {
    const { book, chapter, scene } = await createBook();
    expect(book.title).toBe("Nova knjiga");
    expect(chapter.title).toBe("Poglavlje I");
    expect(scene.title).toBe("Scena 1");
    expect(scene.bookId).toBe(book.id);
    expect(await firstSceneId(book.id)).toBe(scene.id);
  });

  it("lists books by most recently updated", async () => {
    const a = await createBook("A");
    await createBook("B");
    await renameBook(a.book.id, "A2");
    const titles = (await listBooks()).map((b) => b.title);
    expect(titles).toEqual(["A2", "B"]);
  });
});

describe("chapters and scenes", () => {
  it("appends chapters with roman titles, each with its own first scene", async () => {
    const { book } = await createBook();
    const { chapter, scene } = await createChapter(book.id);
    expect(chapter.title).toBe("Poglavlje II");
    expect(scene.chapterId).toBe(chapter.id);

    const chapters = await listChapters(book.id);
    expect(chapters.map((c) => c.title)).toEqual(["Poglavlje I", "Poglavlje II"]);
    expect(chapters[1]!.order).toBeGreaterThan(chapters[0]!.order);
  });

  it("appends scenes in order and renames them", async () => {
    const { chapter } = await createBook();
    const s2 = await createScene(chapter.id);
    await createScene(chapter.id);
    await renameScene(s2.id, "Na stanici");
    await renameChapter(chapter.id, "Dolazak");

    const titles = (await listScenes(chapter.id)).map((s) => s.title);
    expect(titles).toEqual(["Scena 1", "Na stanici", "Scena 3"]);
    expect((await listChapters(chapter.bookId))[0]!.title).toBe("Dolazak");
  });

  it("builds a 2 × 3 book", async () => {
    const { book, chapter } = await createBook();
    await createScene(chapter.id);
    await createScene(chapter.id);
    const second = await createChapter(book.id);
    await createScene(second.chapter.id);
    await createScene(second.chapter.id);
    expect(await listScenesByBook(book.id)).toHaveLength(6);
  });
});

describe("saving and words today", () => {
  it("persists content and word count", async () => {
    const { scene } = await createBook();
    await saveScene(scene.id, doc("Petar je zastao."), 3, "2026-09-25");
    const saved = await getScene(scene.id);
    expect(saved!.content).toEqual(doc("Petar je zastao."));
    expect(saved!.wordCount).toBe(3);
  });

  it("fixes startWordTotal on first open of the day and keeps it on reopen", async () => {
    const { book, scene } = await createBook();
    await openScene(scene.id, "2026-09-25");
    await saveScene(scene.id, doc("x"), 10, "2026-09-25");

    const reopened = await openScene(scene.id, "2026-09-25");
    expect(reopened!.startWordTotal).toBe(0);
    const stat = await getDailyStat(book.id, "2026-09-25");
    expect(stat!.endWordTotal).toBe(10);
  });

  it("starts the next day from the previous total", async () => {
    const { scene } = await createBook();
    await saveScene(scene.id, doc("x"), 10, "2026-09-25");

    const tomorrow = await openScene(scene.id, "2026-09-26");
    expect(tomorrow!.startWordTotal).toBe(10);
  });

  it("uses the pre-save total when the day rolls over mid-session", async () => {
    const { book, scene } = await createBook();
    await saveScene(scene.id, doc("x"), 10, "2026-09-25");
    await saveScene(scene.id, doc("x"), 14, "2026-09-26");

    const stat = await getDailyStat(book.id, "2026-09-26");
    expect(stat).toMatchObject({ startWordTotal: 10, endWordTotal: 14 });
  });

  it("sums words across scenes and reports the rest of the book", async () => {
    const { book, chapter, scene } = await createBook();
    const other = await createScene(chapter.id);
    await saveScene(scene.id, doc("x"), 5, "2026-09-25");
    await saveScene(other.id, doc("x"), 7, "2026-09-25");

    expect(await bookWordTotal(book.id)).toBe(12);
    const opened = await openScene(scene.id, "2026-09-25");
    expect(opened!.otherScenesTotal).toBe(7);
    expect((await getBook(book.id))!.updatedAt).toBeGreaterThan(0);
  });

  it("returns undefined for a missing scene", async () => {
    expect(await openScene("missing", "2026-09-25")).toBeUndefined();
  });
});
