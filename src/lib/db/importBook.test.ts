import { beforeEach, describe, expect, it } from "vitest";
import { textToBlocks } from "@/lib/import/fromText";
import { splitBook, titlePagePart } from "@/lib/import/splitBook";
import { localDateKey, wordsToday } from "@/lib/stats/today";
import { getBook } from "./books";
import { importBook } from "./importBook";
import { listParts } from "./parts";
import { openPart } from "./session";
import { bookEntryHref, getResumeState } from "./resume";
import { db } from "./schema";

const NOW = new Date(2026, 9, 13, 10, 0).getTime();

const sample = () =>
  splitBook(
    textToBlocks(
      ["Kiša", "Prolog", "Bilo je hladno.", "Poglavlje 1: Vrata", "Petar je zastao.", "Poglavlje 2", "Kofer.", "Epilog", "Kraj priče."].join("\n"),
    ),
  );

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("importBook", () => {
  it("writes the book and its parts in order, with word counts", async () => {
    const split = sample();
    const { book, firstPartId } = await importBook({ title: "  Kiša ", parts: split.parts }, NOW);
    expect(await getBook(book.id)).toMatchObject({ title: "Kiša", language: "sr-Latn", createdAt: NOW, updatedAt: NOW });

    const parts = await listParts(book.id);
    expect(parts.map((part) => [part.kind, part.title, part.wordCount])).toEqual([
      ["front", "Prolog", 3],
      ["chapter", "Vrata", 3],
      ["chapter", "", 1],
      ["back", "Epilog", 2],
    ]);
    expect(parts.map((part) => part.order)).toEqual([1000, 1000, 2000, 1000]);
    expect(parts[1]!.content).toEqual(split.parts[1]!.content);
    expect(firstPartId).toBe(parts[1]!.id);
  });

  it("is not writing: words today 0, no session, no ResumeState, no whisper — and it opens in the editor", async () => {
    const { book, firstPartId } = await importBook({ title: "Kiša", parts: sample().parts }, NOW);
    expect(await db.dailyStats.get([localDateKey(new Date(NOW)), book.id])).toMatchObject({ startWordTotal: 9, endWordTotal: 9 });
    expect(await wordsToday(book.id, localDateKey(new Date(NOW)))).toBe(0);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.whispers.count()).toBe(0);
    expect(await getResumeState(book.id)).toBeUndefined();
    expect(await bookEntryHref(book.id, NOW + 7 * 3_600_000)).toBe(`/write/${firstPartId}`);

    // Opening the first chapter still leaves today at 0.
    await openPart(firstPartId, localDateKey(new Date(NOW)));
    expect(await wordsToday(book.id, localDateKey(new Date(NOW)))).toBe(0);
  });

  it("keeps the title page as „Naslovna” when the author wants it; an empty title is the default", async () => {
    const split = sample();
    const { book } = await importBook({ title: "", parts: [titlePagePart(split.titlePage!), ...split.parts] }, NOW);
    expect((await getBook(book.id))!.title).toBe("Nova knjiga");
    const parts = await listParts(book.id);
    expect(parts.slice(0, 2).map((part) => [part.title, part.order])).toEqual([
      ["Naslovna", 1000],
      ["Prolog", 2000],
    ]);
  });

  it("a book always has a chapter", async () => {
    const { book } = await importBook({ title: "Kiša", parts: [] }, NOW);
    expect((await listParts(book.id)).map((part) => part.kind)).toEqual(["chapter"]);
  });
});
