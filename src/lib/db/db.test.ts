import { beforeEach, describe, expect, it, vi } from "vitest";
import Dexie from "dexie";
import { bookWordTotal, createBook, firstPartId, getBook, listBooks, renameBook } from "./books";
import { getDailyStat } from "./dailyStats";
import { mergeScenes, type LegacyScene } from "./migrations";
import {
  canDeletePart,
  chapterNumber,
  createPart,
  deletePart,
  getPart,
  listParts,
  partHeading,
  purgeDeletedParts,
  renamePart,
  restorePart,
  reorderParts,
  saveLanguageScore,
  savePart,
} from "./parts";
import { getProofResult, proofCacheKey, purgeProofCache, saveProofResult } from "./proofCache";
import { bookEntry, bookEntryHref, getResumeState, saveOpenQuestion } from "./resume";
import type { Part, ResumeState } from "./schema";
import { getAppearance, saveAppearance } from "./settings";
import { db } from "./schema";
import { openPart } from "./session";
import { UNDO_DELETE_MS } from "@/lib/timing";

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

describe("deleting parts", () => {
  it("hides a deleted part at once, everywhere", async () => {
    const { book, part: a } = await createBook();
    const b = await createPart(book.id, "chapter", "Kofer");
    await savePart(a.id, doc("Petar je zastao."), 3, "2026-10-02");
    await savePart(b.id, doc("Kofer je bio težak."), 4, "2026-10-02");

    await deletePart(b.id);
    expect((await listParts(book.id)).map((p) => p.id)).toEqual([a.id]);
    expect(await getPart(b.id)).toBeUndefined();
    expect(await openPart(b.id, "2026-10-02")).toBeUndefined();
    expect(await bookWordTotal(book.id)).toBe(3);
    expect((await openPart(a.id, "2026-10-02"))!.otherPartsTotal).toBe(0);
  });

  it("undo brings it back in the same place with all its text", async () => {
    const { book, part: a } = await createBook();
    const b = await createPart(book.id, "chapter", "Kofer");
    const c = await createPart(book.id, "chapter");
    const text = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Kofer." }, { type: "footnoteRef", attrs: { id: "n1" } }] },
        { type: "footnotes", content: [{ type: "footnote", attrs: { id: "n1" }, content: [{ type: "text", text: "Beleška." }] }] },
      ],
    };
    await savePart(b.id, text, 1, "2026-10-02");

    await deletePart(b.id);
    await restorePart(b.id);

    const parts = await listParts(book.id);
    expect(parts.map((p) => p.id)).toEqual([a.id, b.id, c.id]);
    expect(chapterNumber(parts, b.id)).toBe(2);
    const restored = (await getPart(b.id))!;
    expect(restored).toMatchObject({ title: "Kofer", wordCount: 1, content: text });
    expect(restored).not.toHaveProperty("deletedAt");
  });

  it("keeps the last chapter; front and back matter can always go", async () => {
    const { book, part } = await createBook();
    const dedication = await createPart(book.id, "front", "Posveta");
    const parts = await listParts(book.id);
    expect(canDeletePart(parts, part)).toBe(false);
    expect(canDeletePart(parts, dedication)).toBe(true);
    await expect(deletePart(part.id)).rejects.toThrow();
    expect(await getPart(part.id)).toBeDefined();
  });

  it("purges only after the undo time, and drops a resume point that pointed there", async () => {
    const { book, part: a } = await createBook();
    const b = await createPart(book.id, "chapter");
    await savePart(b.id, doc("Tekst."), 1, "2026-10-02", { pos: 3, lastSentence: "Tekst." });

    await deletePart(b.id, 50_000);
    expect(await purgeDeletedParts(55_000)).toBe(0);
    expect(await db.parts.get(b.id)).toBeDefined();

    expect(await purgeDeletedParts(60_000)).toBe(1);
    expect(await db.parts.get(b.id)).toBeUndefined();
    expect(await getResumeState(book.id)).toBeUndefined();
    expect((await listParts(book.id)).map((p) => p.id)).toEqual([a.id]);
  });

  it("keeps the resume point when another part is purged", async () => {
    const { book, part: a } = await createBook();
    const b = await createPart(book.id, "back", "Epilog");
    await savePart(a.id, doc("Tekst."), 1, "2026-10-02", { pos: 3, lastSentence: "Tekst." });
    await deletePart(b.id, 0);
    await purgeDeletedParts(UNDO_DELETE_MS);
    expect(await getResumeState(book.id)).toMatchObject({ partId: a.id });
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

describe("bookEntry", () => {
  const HOUR = 60 * 60 * 1000;
  const now = 100 * HOUR;
  const part = (id: string, kind: Part["kind"], order: number, wordCount: number): Part => ({
    id,
    bookId: "b",
    kind,
    title: "",
    order,
    content: doc(""),
    wordCount,
    createdAt: 0,
    updatedAt: 0,
  });
  const state = (partId: string, hoursAgo: number): ResumeState => ({
    bookId: "b",
    partId,
    cursorPos: 5,
    lastSentence: "Petar je zastao.",
    lastWrittenAt: now - hoursAgo * HOUR,
  });
  const parts = [part("front", "front", 1, 10), part("c1", "chapter", 1, 300), part("c2", "chapter", 2, 50)];

  it("opens the part last written in when the break was short", () => {
    expect(bookEntry(parts, state("c2", 5.9), now)).toEqual({ kind: "write", partId: "c2" });
  });

  it("shows Resume after more than 6 hours", () => {
    expect(bookEntry(parts, state("c2", 6.1), now)).toEqual({ kind: "resume" });
    expect(bookEntry(parts, state("c2", 24 * 5), now)).toEqual({ kind: "resume" });
  });

  it("goes straight to the editor when the book has no words yet", () => {
    const empty = [part("c1", "chapter", 1, 0), part("c2", "chapter", 2, 0)];
    expect(bookEntry(empty, state("c2", 48), now)).toEqual({ kind: "write", partId: "c1" });
  });

  it("falls back to the first chapter without a saved state or when the part is gone", () => {
    expect(bookEntry(parts, undefined, now)).toEqual({ kind: "write", partId: "c1" });
    expect(bookEntry(parts, state("deleted", 1), now)).toEqual({ kind: "write", partId: "c1" });
  });

  it("has nowhere to go in a book without parts", () => {
    expect(bookEntry([], undefined, now)).toBeNull();
  });
});

describe("resume in the database", () => {
  it("opens a written book on Resume after a break, and the editor right after writing", async () => {
    const { book, part } = await createBook();
    await savePart(part.id, doc("Petar je zastao."), 3, "2026-09-25", { pos: 9, lastSentence: "Petar je zastao." });
    const writtenAt = (await getResumeState(book.id))!.lastWrittenAt;

    expect(await bookEntryHref(book.id, writtenAt + 60_000)).toBe(`/write/${part.id}`);
    expect(await bookEntryHref(book.id, writtenAt + 7 * 60 * 60 * 1000)).toBe(`/resume?book=${book.id}`);
  });

  it("caches the open question with its key and keeps it through later saves", async () => {
    const { book, part } = await createBook();
    await savePart(part.id, doc("x"), 1, "2026-09-25", { pos: 2, lastSentence: "x" });
    await saveOpenQuestion(book.id, "Ko je na vratima?", `${part.id}:abcd1234`);
    await savePart(part.id, doc("x y"), 2, "2026-09-25", { pos: 4, lastSentence: "x y" });
    expect(await getResumeState(book.id)).toMatchObject({
      cursorPos: 4,
      openQuestion: "Ko je na vratima?",
      openQuestionFor: `${part.id}:abcd1234`,
    });
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
    expect(db.tables.map((t) => t.name).sort()).toEqual(["books", "dailyStats", "parts", "proofCache", "resumeState", "settings"]);
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

    expect(db.verno).toBe(7);
    expect((await getPart("p1"))?.content).toEqual(doc("Tekst ostaje."));
    expect(await db.settings.count()).toBe(0);
    expect(await getAppearance()).toEqual({ key: "appearance", focusMode: false, typewriter: false });
  });

  it("v4 → v5: a Naslov 1 identical to the chapter name leaves the text, anything else stays", async () => {
    const h1 = (text: string) => ({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text }] });
    const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
    const part = (id: string, kind: string, title: string, order: number, blocks: object[], wordCount: number) => ({
      id,
      bookId: "b1",
      kind,
      title,
      order,
      content: { type: "doc", content: blocks },
      wordCount,
      createdAt: 1,
      updatedAt: 1,
    });

    db.close();
    await Dexie.delete("momentum");
    const v4 = new Dexie("momentum");
    v4.version(4).stores({ ...V1_STORES, parts: "id, bookId", chapters: null, scenes: null, settings: "key" });
    await v4.table("books").add({ id: "b1", title: "Knjiga", language: "sr-Latn", createdAt: 1, updatedAt: 1 });
    await v4.table("parts").bulkAdd([
      part("front", "front", "Posveta", 1000, [h1("Posveta"), p("Mami.")], 2),
      part("c1", "chapter", "Vrata", 1000, [h1("vrata "), p("Petar je zastao.")], 4),
      // Second chapter: the heading may carry the number, as the header showed it.
      part("c2", "chapter", "Kofer", 2000, [h1("Poglavlje II · Kofer"), p("Kofer je bio težak.")], 7),
      part("c3", "chapter", "Treće", 3000, [h1("III · Treće")], 2),
      part("c4", "chapter", "Noć", 4000, [h1("Druga noć"), p("Tekst.")], 3),
      part("c5", "chapter", "Jutro", 5000, [p("Uvod."), h1("Jutro")], 2),
      part("c6", "chapter", "", 6000, [h1(""), p("Bez naslova.")], 2),
    ]);
    v4.close();
    await db.open();

    expect(db.verno).toBe(7);
    const blocks = async (id: string) => (await getPart(id))!.content.content;
    expect(await blocks("front")).toEqual([p("Mami.")]);
    expect((await getPart("front"))!.wordCount).toBe(1);
    expect(await blocks("c1")).toEqual([p("Petar je zastao.")]);
    expect((await getPart("c1"))!).toMatchObject({ title: "Vrata", wordCount: 3 });
    expect(await blocks("c2")).toEqual([p("Kofer je bio težak.")]);
    expect((await getPart("c2"))!.wordCount).toBe(4);
    // Only the title: an empty paragraph is left to write in.
    expect(await blocks("c3")).toEqual([{ type: "paragraph" }]);
    expect((await getPart("c3"))!.wordCount).toBe(0);
    // Different text, not the first block, or an empty heading: the author's text stays.
    expect(await blocks("c4")).toEqual([h1("Druga noć"), p("Tekst.")]);
    expect(await blocks("c5")).toEqual([p("Uvod."), h1("Jutro")]);
    expect(await blocks("c6")).toEqual([h1(""), p("Bez naslova.")]);
  });

  it("v5 → v6: every part stays, none counts as deleted", async () => {
    db.close();
    await Dexie.delete("momentum");
    const v5 = new Dexie("momentum");
    v5.version(5).stores({ ...V1_STORES, parts: "id, bookId", chapters: null, scenes: null, settings: "key" });
    await v5.table("books").add({ id: "b1", title: "Knjiga", language: "sr-Latn", createdAt: 1, updatedAt: 1 });
    await v5.table("parts").bulkAdd(
      ["p1", "p2"].map((id, i) => ({
        id,
        bookId: "b1",
        kind: "chapter",
        title: id,
        order: (i + 1) * 1000,
        content: doc(`Tekst ${id}.`),
        wordCount: 2,
        createdAt: 1,
        updatedAt: 1,
      })),
    );
    v5.close();
    await db.open();

    expect(db.verno).toBe(7);
    expect((await listParts("b1")).map((p) => p.id)).toEqual(["p1", "p2"]);
    expect((await getPart("p2"))?.content).toEqual(doc("Tekst p2."));
    expect(await bookWordTotal("b1")).toBe(4);
  });

  it("v6 → v7: parts stay, the language check cache starts empty", async () => {
    db.close();
    await Dexie.delete("momentum");
    const v6 = new Dexie("momentum");
    v6.version(6).stores({ ...V1_STORES, parts: "id, bookId", chapters: null, scenes: null, settings: "key" });
    await v6.table("books").add({ id: "b1", title: "Knjiga", language: "sr-Latn", createdAt: 1, updatedAt: 1 });
    await v6.table("parts").add({
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
    v6.close();
    await db.open();

    expect(db.verno).toBe(7);
    expect((await getPart("p1"))?.content).toEqual(doc("Tekst ostaje."));
    expect((await getPart("p1"))?.languageScore).toBeUndefined();
    expect(await db.proofCache.count()).toBe(0);
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

describe("language check cache", () => {
  const DAY = 24 * 60 * 60 * 1000;

  it("keys by version, language and text hash", () => {
    expect(proofCacheKey("sr-Latn", "Tekst.")).toMatch(/^v1:sr-Latn:[0-9a-f]{8}$/);
  });

  it("returns a saved check for exactly the same text and refreshes usedAt", async () => {
    await saveProofResult("sr-Latn", "Cuo je.", { corrected: "Čuo je.", rejected: [] }, 1_000);
    expect(await getProofResult("sr-Latn", "Cuo je.", 5_000)).toEqual({ corrected: "Čuo je.", rejected: [] });
    expect((await db.proofCache.get(proofCacheKey("sr-Latn", "Cuo je.")))!).toMatchObject({ createdAt: 1_000, usedAt: 5_000 });
    expect(await getProofResult("sr-Latn", "Cuo je")).toBeUndefined();
  });

  it("treats a hash collision as a miss", async () => {
    await db.proofCache.put({
      key: proofCacheKey("sr-Latn", "Prvi."),
      text: "Drugi.",
      corrected: "Drugi.",
      rejected: [],
      createdAt: 1,
      usedAt: 1,
    });
    expect(await getProofResult("sr-Latn", "Prvi.")).toBeUndefined();
  });

  it("removes entries unused for 90 days — by last use, not by creation", async () => {
    const now = 200 * DAY;
    await saveProofResult("sr-Latn", "Star, ali korišćen.", { corrected: "Star, ali korišćen.", rejected: [] }, 0);
    await getProofResult("sr-Latn", "Star, ali korišćen.", now - 10 * DAY);
    await saveProofResult("sr-Latn", "Zaboravljen.", { corrected: "Zaboravljen.", rejected: [] }, now - 91 * DAY);

    expect(await purgeProofCache(now)).toBe(1);
    expect(await getProofResult("sr-Latn", "Star, ali korišćen.", now)).toBeDefined();
    expect(await getProofResult("sr-Latn", "Zaboravljen.", now)).toBeUndefined();
  });
});

describe("language score in the database", () => {
  it("saves a chapter score and the book score with its previous value", async () => {
    const { book, part: a } = await createBook();
    const b = await createPart(book.id, "chapter");

    await saveLanguageScore(a.id, { score: 100, diacritics: 0, grammar: 0, words: 300 });
    expect((await getBook(book.id))!.languageScore).toEqual({ value: 100, previous: undefined });

    await saveLanguageScore(b.id, { score: 80, diacritics: 4, grammar: 0, words: 100 });
    expect((await getPart(b.id))!.languageScore).toEqual({ score: 80, diacritics: 4, grammar: 0, words: 100 });
    expect((await getBook(book.id))!.languageScore).toEqual({ value: 95, previous: 100 });
  });

  it("ignores a deleted part", async () => {
    const { book } = await createBook();
    const b = await createPart(book.id, "chapter");
    await deletePart(b.id);
    await saveLanguageScore(b.id, { score: 50, diacritics: 0, grammar: 5, words: 100 });
    expect((await getBook(book.id))!.languageScore).toBeUndefined();
  });
});
