import { beforeEach, describe, expect, it, vi } from "vitest";
import Dexie from "dexie";
import { bookWordTotal, createBook, firstPartId, getBook, listBooks, renameBook } from "./books";
import { getDailyStat } from "./dailyStats";
import { mergeScenes, type LegacyScene } from "./migrations";
import {
  chapterNumber,
  createPart,
  getPart,
  listParts,
  partHeading,
  renamePart,
  reorderParts,
  savePart,
} from "./parts";
import { getResumeState } from "./resume";
import { getAppearance, saveAppearance } from "./settings";
import { db } from "./schema";
import { openPart } from "./session";

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
  it("creates a book that opens into Poglavlje I", async () => {
    const { book, part } = await createBook();
    expect(book.title).toBe("Nova knjiga");
    expect(part).toMatchObject({ bookId: book.id, kind: "chapter", title: "" });
    expect(await firstPartId(book.id)).toBe(part.id);
    expect(partHeading(part, 1)).toBe("Poglavlje I");
  });

  it("lists books by most recently updated", async () => {
    const a = await createBook("A");
    await createBook("B");
    await renameBook(a.book.id, "A2");
    const titles = (await listBooks()).map((b) => b.title);
    expect(titles).toEqual(["A2", "B"]);
  });

  it("gives new books the default language", async () => {
    const { book } = await createBook();
    expect((await getBook(book.id))!.language).toBe("sr-Latn");
  });
});

describe("parts", () => {
  it("keeps front matter, chapters and back matter in book order", async () => {
    const { book, part: first } = await createBook();
    const epilogue = await createPart(book.id, "back", "Epilog");
    const second = await createPart(book.id, "chapter");
    const dedication = await createPart(book.id, "front", "Posveta");

    const parts = await listParts(book.id);
    expect(parts.map((p) => p.id)).toEqual([dedication.id, first.id, second.id, epilogue.id]);
    expect(chapterNumber(parts, second.id)).toBe(2);
    expect(chapterNumber(parts, dedication.id)).toBeUndefined();
    expect(await firstPartId(book.id)).toBe(first.id);
  });

  it("names chapters by number, with an optional title", async () => {
    const { book, part } = await createBook();
    await renamePart(part.id, "Dolazak");
    const renamed = (await getPart(part.id))!;
    expect(partHeading(renamed, 1)).toBe("Poglavlje I · Dolazak");
    const posveta = await createPart(book.id, "front", "Posveta");
    expect(partHeading(posveta, undefined)).toBe("Posveta");
  });

  it("renumbers chapters after reordering", async () => {
    const { book, part: a } = await createBook();
    const b = await createPart(book.id, "chapter");
    const c = await createPart(book.id, "chapter");
    await reorderParts([c.id, a.id, b.id]);

    const parts = await listParts(book.id);
    expect(parts.map((p) => p.id)).toEqual([c.id, a.id, b.id]);
    expect(chapterNumber(parts, a.id)).toBe(2);
  });
});

describe("saving and words today", () => {
  it("persists content and word count", async () => {
    const { part } = await createBook();
    await savePart(part.id, doc("Petar je zastao."), 3, "2026-09-25");
    const saved = await getPart(part.id);
    expect(saved!.content).toEqual(doc("Petar je zastao."));
    expect(saved!.wordCount).toBe(3);
  });

  it("fixes startWordTotal on first open of the day and keeps it on reopen", async () => {
    const { book, part } = await createBook();
    await openPart(part.id, "2026-09-25");
    await savePart(part.id, doc("x"), 10, "2026-09-25");

    const reopened = await openPart(part.id, "2026-09-25");
    expect(reopened!.startWordTotal).toBe(0);
    const stat = await getDailyStat(book.id, "2026-09-25");
    expect(stat!.endWordTotal).toBe(10);
  });

  it("starts the next day from the previous total", async () => {
    const { part } = await createBook();
    await savePart(part.id, doc("x"), 10, "2026-09-25");

    const tomorrow = await openPart(part.id, "2026-09-26");
    expect(tomorrow!.startWordTotal).toBe(10);
  });

  it("uses the pre-save total when the day rolls over mid-session", async () => {
    const { book, part } = await createBook();
    await savePart(part.id, doc("x"), 10, "2026-09-25");
    await savePart(part.id, doc("x"), 14, "2026-09-26");

    const stat = await getDailyStat(book.id, "2026-09-26");
    expect(stat).toMatchObject({ startWordTotal: 10, endWordTotal: 14 });
  });

  it("sums words across parts and reports the rest of the book", async () => {
    const { book, part } = await createBook();
    const other = await createPart(book.id, "chapter");
    await savePart(part.id, doc("x"), 5, "2026-09-25");
    await savePart(other.id, doc("x"), 7, "2026-09-25");

    expect(await bookWordTotal(book.id)).toBe(12);
    const opened = await openPart(other.id, "2026-09-25");
    expect(opened).toMatchObject({ otherPartsTotal: 5, chapterNumber: 2 });
  });

  it("returns undefined for a missing part", async () => {
    expect(await openPart("missing", "2026-09-25")).toBeUndefined();
  });
});

describe("resume state", () => {
  it("records part, cursor, last sentence and time on save", async () => {
    const { book, part } = await createBook();
    await savePart(part.id, doc("Petar je zastao."), 3, "2026-09-25", {
      pos: 17,
      lastSentence: "Petar je zastao.",
    });

    const state = await getResumeState(book.id);
    expect(state).toMatchObject({
      bookId: book.id,
      partId: part.id,
      cursorPos: 17,
      lastSentence: "Petar je zastao.",
    });
    expect(state!.lastWrittenAt).toBe((await getPart(part.id))!.updatedAt);
  });

  it("moves the resume point on later saves but keeps the cached open question", async () => {
    const { book, part } = await createBook();
    await savePart(part.id, doc("x"), 1, "2026-09-25", { pos: 2, lastSentence: "x" });
    await db.resumeState.update(book.id, { openQuestion: "Ko je na vratima?", openQuestionFor: "abc" });
    const first = (await getResumeState(book.id))!.lastWrittenAt;

    const other = await createPart(book.id, "chapter");
    await savePart(other.id, doc("y z"), 2, "2026-09-25", { pos: 4, lastSentence: "y z" });

    const state = await getResumeState(book.id);
    expect(state).toMatchObject({
      partId: other.id,
      cursorPos: 4,
      lastSentence: "y z",
      openQuestion: "Ko je na vratima?",
      openQuestionFor: "abc",
    });
    expect(state!.lastWrittenAt).toBeGreaterThan(first);
  });

  it("leaves the resume point alone when saving without a cursor", async () => {
    const { book, part } = await createBook();
    await savePart(part.id, doc("x"), 1, "2026-09-25");
    expect(await getResumeState(book.id)).toBeUndefined();
  });
});

describe("mergeScenes", () => {
  const scene = (order: number, title: string, text: string, words: number): LegacyScene => ({
    id: `s${order}`,
    chapterId: "c",
    bookId: "b",
    title,
    order,
    content: text ? doc(text) : { type: "doc", content: [{ type: "paragraph" }] },
    wordCount: words,
    createdAt: 1,
    updatedAt: 1,
  });

  it("joins scenes with breaks, keeps real titles in italics and drops empty scenes", () => {
    const { content, wordCount } = mergeScenes([
      scene(1, "Scena 1", "Prva.", 1),
      scene(2, "Scena 2", "", 0),
      scene(3, "Na stanici", "Druga scena.", 2),
    ]);
    expect(content.content).toEqual([
      doc("Prva.").content[0],
      { type: "sceneBreak" },
      { type: "paragraph", content: [{ type: "text", text: "Na stanici", marks: [{ type: "italic" }] }] },
      doc("Druga scena.").content[0],
    ]);
    expect(wordCount).toBe(1 + 2 + 2);
  });

  it("gives a chapter of only empty scenes an empty document", () => {
    expect(mergeScenes([scene(1, "Scena 1", "", 0)]).content).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });
});

describe("migrations", () => {
  const V1_STORES = {
    books: "id, updatedAt",
    chapters: "id, bookId, [bookId+order]",
    scenes: "id, chapterId, bookId, [chapterId+order], updatedAt",
    dailyStats: "[date+bookId], bookId",
    resumeState: "bookId",
  };

  async function seedV1(seed: (v1: Dexie) => Promise<void>) {
    db.close();
    await Dexie.delete("momentum");
    const v1 = new Dexie("momentum");
    v1.version(1).stores(V1_STORES);
    await seed(v1);
    v1.close();
    await db.open();
  }

  const legacyScene = (id: string, chapterId: string, order: number, title: string, text: string) => ({
    id,
    chapterId,
    bookId: "b1",
    title,
    order,
    content: doc(text),
    wordCount: text.split(" ").length,
    createdAt: 1,
    updatedAt: 1,
  });

  it("v1 → v3: 2 chapters × 3 scenes keep all text in order", async () => {
    await seedV1(async (v1) => {
      await v1.table("books").add({ id: "b1", title: "Stara", createdAt: 1, updatedAt: 1 });
      await v1.table("chapters").bulkAdd([
        { id: "c2", bookId: "b1", title: "Dolazak", order: 2000, createdAt: 1, updatedAt: 1 },
        { id: "c1", bookId: "b1", title: "Poglavlje I", order: 1000, createdAt: 1, updatedAt: 1 },
      ]);
      // Added out of order on purpose: the merge must follow `order`.
      await v1.table("scenes").bulkAdd([
        legacyScene("s3", "c1", 3000, "Scena 3", "Treća scena."),
        legacyScene("s1", "c1", 1000, "Scena 1", "Prva scena."),
        legacyScene("s2", "c1", 2000, "Noć", "Druga scena."),
        legacyScene("s4", "c2", 1000, "Scena 1", "Četvrta."),
        legacyScene("s5", "c2", 2000, "Scena 2", "Peta."),
        legacyScene("s6", "c2", 3000, "Scena 3", "Šesta."),
      ]);
      await v1.table("resumeState").add({
        bookId: "b1",
        sceneId: "s5",
        cursorPos: 42,
        lastSentence: "Peta.",
        lastWrittenAt: 5,
      });
    });

    const [c1, c2] = await listParts("b1");
    expect(c1).toMatchObject({ id: "c1", kind: "chapter", title: "" });
    expect(c2).toMatchObject({ id: "c2", kind: "chapter", title: "Dolazak" });

    const lines = (content: typeof c1) =>
      content!.content.content!.map((node) =>
        node.type === "sceneBreak" ? "***" : node.content?.[0]?.text,
      );
    expect(lines(c1)).toEqual(["Prva scena.", "***", "Noć", "Druga scena.", "***", "Treća scena."]);
    expect(lines(c2)).toEqual(["Četvrta.", "***", "Peta.", "***", "Šesta."]);
    expect(c1!.wordCount).toBe(2 + 1 + 2 + 2);
    expect(await bookWordTotal("b1")).toBe(7 + 3);

    expect(await getBook("b1")).toMatchObject({ title: "Stara", language: "sr-Latn" });
    const resume = await getResumeState("b1");
    expect(resume).toMatchObject({ partId: "c2", cursorPos: 0, lastSentence: "Peta." });
    expect(resume).not.toHaveProperty("sceneId");
    expect(db.tables.map((t) => t.name).sort()).toEqual(["books", "dailyStats", "parts", "resumeState", "settings"]);
  });

  it("v3 → v4: parts stay, settings start empty (defaults)", async () => {
    db.close();
    await Dexie.delete("momentum");
    const v3 = new Dexie("momentum");
    v3.version(3).stores({ ...V1_STORES, parts: "id, bookId", chapters: null, scenes: null });
    await v3.table("books").add({ id: "b1", title: "Knjiga", language: "sr-Latn", createdAt: 1, updatedAt: 1 });
    await v3.table("parts").add({
      id: "p1",
      bookId: "b1",
      kind: "chapter",
      title: "",
      order: 1000,
      content: doc("Tekst ostaje."),
      wordCount: 2,
      createdAt: 1,
      updatedAt: 1,
    });
    v3.close();
    await db.open();

    expect(db.verno).toBe(4);
    expect((await getPart("p1"))?.content).toEqual(doc("Tekst ostaje."));
    expect(await db.settings.count()).toBe(0);
    expect(await getAppearance()).toEqual({ key: "appearance", focusMode: false, typewriter: false });
  });
});

describe("appearance settings", () => {
  it("starts from defaults: system theme, no focus mode, no typewriter", async () => {
    const appearance = await getAppearance();
    expect(appearance.theme).toBeUndefined();
    expect(appearance).toMatchObject({ focusMode: false, typewriter: false });
  });

  it("saves only what changed and keeps the rest", async () => {
    await saveAppearance({ theme: "masina" });
    await saveAppearance({ focusMode: true });
    expect(await getAppearance()).toEqual({ key: "appearance", theme: "masina", focusMode: true, typewriter: false });
  });
});
