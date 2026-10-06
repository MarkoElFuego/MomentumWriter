import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBook, updateBook } from "@/lib/db/books";
import { db, type Session } from "@/lib/db/schema";
import { listWhispers } from "@/lib/db/whispers";
import type { TironRequest } from "@/lib/ai/tiron";
import { requestWhisper, whisperSessionEndIfDue } from "./whisper";

const HOUR = 60 * 60 * 1_000;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 9, 6, 12, 0).getTime();

const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

let reply: Record<string, unknown>;
const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: reply }), { status: 200 }));
const sent = (call = 0) => JSON.parse((fetchMock.mock.calls[call] as unknown as [string, RequestInit])[1].body as string) as TironRequest;
const storage = new Map<string, string>();

beforeEach(async () => {
  reply = { whisper: "Mara još čuva kofer — šta će Petar reći?", kind: "story" };
  fetchMock.mockClear();
  storage.clear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await db.delete();
  await db.open();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function bookWithText() {
  const { book, part } = await createBook("Kiša");
  await db.parts.update(part.id, { content: doc("Kiša je padala celu noć, a Mara je čuvala kofer."), wordCount: 10 });
  return { book, part };
}

async function session(bookId: string, partId: string, change: Partial<Session> = {}): Promise<Session> {
  const saved: Session = {
    id: `s${Math.random()}`,
    bookId,
    partIds: [partId],
    startedAt: NOW - 2 * HOUR,
    endedAt: NOW - HOUR,
    wordsAdded: 600,
    wordsDeleted: 50,
    hour: 10,
    ...change,
  };
  await db.sessions.add(saved);
  return saved;
}

describe("whispers — modes", () => {
  it("off: no whisper, not even a request", async () => {
    storage.set("momentum:tiron", "off");
    const { book } = await bookWithText();
    expect(await requestWhisper({ moment: "entry", bookId: book.id }, NOW)).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("quiet: entering yes, the end of a chapter no", async () => {
    storage.set("momentum:tiron", "quiet");
    const { book, part } = await bookWithText();
    expect(await requestWhisper({ moment: "chapterEnd", partId: part.id }, NOW)).toBe("skipped");
    expect(await requestWhisper({ moment: "entry", bookId: book.id }, NOW)).toBe("said");
  });
});

describe("whispers — entering the book", () => {
  it("greets with the heart, memory and signals, unseen; not twice within an hour", async () => {
    const { book } = await bookWithText();
    await updateBook(book.id, { heart: { why: "Zbog bake." } });
    expect(await requestWhisper({ moment: "entry", bookId: book.id }, NOW)).toBe("said");
    expect(sent()).toMatchObject({ mode: "tiron", moment: "entry", bookTitle: "Kiša", heart: { why: "Zbog bake." } });
    expect(sent().signals).toBeDefined();
    expect(sent()).not.toHaveProperty("text");

    const [saved] = await listWhispers(book.id);
    expect(saved).toMatchObject({ moment: "entry", kind: "story", seen: false, dismissed: false, createdAt: NOW });

    expect(await requestWhisper({ moment: "entry", bookId: book.id }, NOW + 30 * 60_000)).toBe("skipped");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("names a process pattern instead — at most once a day — with the best lines", async () => {
    const { book, part } = await bookWithText();
    await session(book.id, part.id, { startedAt: NOW - 5 * DAY, endedAt: NOW - 5 * DAY + HOUR });
    await db.books.update(book.id, { bestLines: [{ partId: part.id, text: "Mara je čuvala kofer.", savedAt: 1 }] });

    await requestWhisper({ moment: "entry", bookId: book.id }, NOW);
    expect(sent()).toMatchObject({ moment: "pattern", pattern: "longBreak", bestLines: ["Mara je čuvala kofer."] });
    expect(sent()).not.toHaveProperty("memory");

    // Later the same day: a plain greeting.
    await requestWhisper({ moment: "entry", bookId: book.id }, NOW + 2 * HOUR);
    expect(sent(1)).toMatchObject({ moment: "entry" });
    expect(sent(1)).not.toHaveProperty("pattern");
  });

  it("a quote keeps the part it came from", async () => {
    const { book, part } = await bookWithText();
    await db.books.update(book.id, { bestLines: [{ partId: part.id, text: "Mara je čuvala kofer.", savedAt: 1 }] });
    reply = { whisper: "Ovo si ti napisao.", kind: "why", quote: "Mara je čuvala kofer." };
    await requestWhisper({ moment: "entry", bookId: book.id }, NOW);
    expect((await listWhispers(book.id))[0]).toMatchObject({ quote: "Mara je čuvala kofer.", quotePartId: part.id });
  });
});

describe("whispers — end of a chapter", () => {
  it("sends the end of the chapter; at most two per session", async () => {
    const { book, part } = await bookWithText();
    await session(book.id, part.id);
    expect(await requestWhisper({ moment: "chapterEnd", partId: part.id }, NOW)).toBe("said");
    expect(sent()).toMatchObject({ moment: "chapterEnd", text: "Kiša je padala celu noć, a Mara je čuvala kofer." });
    expect(sent()).not.toHaveProperty("signals");

    expect(await requestWhisper({ moment: "chapterEnd", partId: part.id }, NOW + 1)).toBe("said");
    expect(await requestWhisper({ moment: "chapterEnd", partId: part.id }, NOW + 2)).toBe("skipped");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("whispers — end of a session", () => {
  it("once per session, only after 20 minutes without a save, only with 100+ new words", async () => {
    const { book, part } = await bookWithText();
    const small = await session(book.id, part.id, { wordsAdded: 99 });
    expect(await requestWhisper({ moment: "sessionEnd", session: small }, NOW)).toBe("skipped");

    await db.sessions.delete(small.id);
    await session(book.id, part.id, { endedAt: NOW - 10 * 60_000 });
    // Ten minutes is not the end yet.
    expect(await whisperSessionEndIfDue(book.id, undefined, NOW)).toBe("skipped");
    // A tab hidden for ten minutes is.
    expect(await whisperSessionEndIfDue(book.id, NOW - 10 * 60_000, NOW)).toBe("said");
    expect(sent()).toMatchObject({ moment: "sessionEnd" });
    expect(sent().text).toContain("Mara");
    expect(sent()).not.toHaveProperty("heart");

    expect(await whisperSessionEndIfDue(book.id, undefined, NOW + HOUR)).toBe("skipped");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a failed request leaves no whisper", async () => {
    const { book, part } = await bookWithText();
    fetchMock.mockImplementationOnce(async () => new Response("{}", { status: 502 }));
    await session(book.id, part.id);
    expect(await whisperSessionEndIfDue(book.id, undefined, NOW)).toBe("failed");
    expect(await listWhispers(book.id)).toEqual([]);
  });
});
