import { beforeEach, describe, expect, it, vi } from "vitest";
import Dexie from "dexie";
import { bookWordTotal, createBook, firstSceneId, getBook, listBooks, renameBook } from "./books";
import { createChapter, listChapters, renameChapter } from "./chapters";
import { getDailyStat } from "./dailyStats";
import { getResumeState } from "./resume";
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

describe("resume state", () => {
  it("records scene, cursor, last sentence and time on save", async () => {
    const { book, scene } = await createBook();
    await saveScene(scene.id, doc("Petar je zastao."), 3, "2026-09-25", {
      pos: 17,
      lastSentence: "Petar je zastao.",
    });

    const state = await getResumeState(book.id);
    expect(state).toMatchObject({
      bookId: book.id,
      sceneId: scene.id,
      cursorPos: 17,
      lastSentence: "Petar je zastao.",
    });
    expect(state!.lastWrittenAt).toBe((await getScene(scene.id))!.updatedAt);
  });

  it("moves the resume point on later saves but keeps the cached open question", async () => {
    const { book, chapter, scene } = await createBook();
    await saveScene(scene.id, doc("x"), 1, "2026-09-25", { pos: 2, lastSentence: "x" });
    await db.resumeState.update(book.id, { openQuestion: "Ko je na vratima?", openQuestionFor: "abc" });
    const first = (await getResumeState(book.id))!.lastWrittenAt;

    const other = await createScene(chapter.id);
    await saveScene(other.id, doc("y z"), 2, "2026-09-25", { pos: 4, lastSentence: "y z" });

    const state = await getResumeState(book.id);
    expect(state).toMatchObject({
      sceneId: other.id,
      cursorPos: 4,
      lastSentence: "y z",
      openQuestion: "Ko je na vratima?",
      openQuestionFor: "abc",
    });
    expect(state!.lastWrittenAt).toBeGreaterThan(first);
  });

  it("leaves the resume point alone when saving without a cursor", async () => {
    const { book, scene } = await createBook();
    await saveScene(scene.id, doc("x"), 1, "2026-09-25");
    expect(await getResumeState(book.id)).toBeUndefined();
  });
});

describe("migrations", () => {
  it("v1 → v2 gives old books a language and keeps their text", async () => {
    db.close();
    await Dexie.delete("momentum");
    const v1 = new Dexie("momentum");
    v1.version(1).stores({
      books: "id, updatedAt",
      chapters: "id, bookId, [bookId+order]",
      scenes: "id, chapterId, bookId, [chapterId+order], updatedAt",
      dailyStats: "[date+bookId], bookId",
      resumeState: "bookId",
    });
    await v1.table("books").add({ id: "b1", title: "Stara", createdAt: 1, updatedAt: 1 });
    await v1.table("scenes").add({
      id: "s1", chapterId: "c1", bookId: "b1", title: "Scena 1", order: 1000,
      content: doc("Petar je zastao."), wordCount: 3, createdAt: 1, updatedAt: 1,
    });
    v1.close();

    await db.open();
    expect(await getBook("b1")).toMatchObject({ title: "Stara", language: "sr-Latn" });
    expect((await getScene("s1"))!.content).toEqual(doc("Petar je zastao."));
  });

  it("new books get the default language", async () => {
    const { book } = await createBook();
    expect((await getBook(book.id))!.language).toBe("sr-Latn");
  });
});
