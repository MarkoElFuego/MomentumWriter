import { MEMORY_ITEM_CHARS, MEMORY_LIST_MAX, type MemoryResult } from "@/lib/ai/memory";
import { clip } from "@/lib/ai/schemas";
import { newId } from "./id";
import { db, MEMORY_LISTS, type ID, type MemoryItem, type MemoryList, type Part, type StoryMemory } from "./schema";

/** New words since Tiron last read a part before leaving it triggers a new read. */
export const MEMORY_NEW_WORDS = 500;
/** ~300 tokens: what „Zapeo sam” (and later the whispers) get, after the fixed system prompt. */
export const COMPACT_MEMORY_CHARS = 1200;

export function emptyMemory(bookId: ID): StoryMemory {
  return { bookId, characters: [], places: [], openThreads: [], updatedAt: 0 };
}

export async function getMemory(bookId: ID): Promise<StoryMemory> {
  return (await db.storyMemory.get(bookId)) ?? emptyMemory(bookId);
}

const key = (text: string) => text.toLocaleLowerCase("sr").replace(/\s+/gu, " ").trim();

/** Enough new words, and a text Tiron hasn't read yet. */
export function needsMemoryUpdate(part: Pick<Part, "wordCount" | "memoryWords" | "summaryForHash">, hash: string): boolean {
  return hash !== part.summaryForHash && Math.abs(part.wordCount - (part.memoryWords ?? 0)) >= MEMORY_NEW_WORDS;
}

/**
 * The AI's new lines replace its old ones; the author's pinned lines stay
 * exactly as they are and first. A line equal to a pinned one is dropped.
 */
export function mergeAiLines(current: MemoryItem[], lines: string[]): MemoryItem[] {
  const pinned = current.filter((item) => item.pinned);
  // Same text keeps its id, so the panel doesn't redraw lines that didn't change.
  const oldIds = new Map(current.filter((item) => !item.pinned).map((item) => [key(item.text), item.id]));
  const seen = new Set(pinned.map((item) => key(item.text)));
  const fresh: MemoryItem[] = [];
  for (const line of lines) {
    const text = clip(line.trim(), MEMORY_ITEM_CHARS);
    const k = key(text);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    fresh.push({ id: oldIds.get(k) ?? newId(), text, source: "ai", pinned: false });
  }
  return [...pinned, ...fresh].slice(0, MEMORY_LIST_MAX);
}

export interface MemoryReadOf {
  partId: ID;
  /** hashText of the part's main text that was sent. */
  hash: string;
  /** Part.wordCount at that moment. */
  words: number;
}

/** One transaction: memory, the part's summary and its strongest sentence. */
export async function applyMemoryResult(bookId: ID, read: MemoryReadOf, result: MemoryResult, now = Date.now()) {
  await db.transaction("rw", db.storyMemory, db.parts, db.books, async () => {
    const memory = await getMemory(bookId);
    const next: StoryMemory = { ...memory, updatedAt: now, updatedAfterPartId: read.partId };
    for (const list of MEMORY_LISTS) next[list] = mergeAiLines(memory[list], result[list]);
    await db.storyMemory.put(next);

    await db.parts.update(read.partId, {
      summary: result.summary,
      summaryForHash: read.hash,
      memoryWords: read.words,
    });

    if (result.bestLine) {
      const book = await db.books.get(bookId);
      // One per part: the new one replaces the old.
      const others = (book?.bestLines ?? []).filter((line) => line.partId !== read.partId);
      await db.books.update(bookId, { bestLines: [...others, { partId: read.partId, text: result.bestLine, savedAt: now }] });
    }
  });
}

async function changeList(bookId: ID, list: MemoryList, change: (items: MemoryItem[]) => MemoryItem[]) {
  await db.transaction("rw", db.storyMemory, async () => {
    const memory = await getMemory(bookId);
    await db.storyMemory.put({ ...memory, [list]: change(memory[list]) });
  });
}

/** The author's line: pinned, so the AI never changes or removes it. False when the list is full. */
export async function addMemoryItem(bookId: ID, list: MemoryList, text: string): Promise<boolean> {
  const clean = clip(text.trim(), MEMORY_ITEM_CHARS);
  if (!clean) return false;
  let added = false;
  await changeList(bookId, list, (items) => {
    if (items.length >= MEMORY_LIST_MAX) return items;
    added = true;
    return [...items, { id: newId(), text: clean, source: "user", pinned: true }];
  });
  return added;
}

/** An edited line becomes the author's (pinned). Empty text removes it. */
export async function editMemoryItem(bookId: ID, list: MemoryList, id: ID, text: string): Promise<void> {
  const clean = clip(text.trim(), MEMORY_ITEM_CHARS);
  await changeList(bookId, list, (items) =>
    clean
      ? items.map((item) => (item.id === id ? { ...item, text: clean, source: "user", pinned: true } : item))
      : items.filter((item) => item.id !== id),
  );
}

export async function removeMemoryItem(bookId: ID, list: MemoryList, id: ID): Promise<void> {
  await changeList(bookId, list, (items) => items.filter((item) => item.id !== id));
}

const COMPACT_LABELS: Record<MemoryList, string> = {
  characters: "Likovi",
  places: "Mesta",
  openThreads: "Otvorene niti",
};

/**
 * Memory as a few short lines for Tiron's calls (never ghost). Over the budget,
 * the last lines of each list go first — lists are ordered most important first.
 */
export function compactMemory(memory: StoryMemory | null): string | undefined {
  if (!memory) return undefined;
  const lists = MEMORY_LISTS.map((list) => ({ list, items: memory[list].map((item) => item.text) }));
  const render = () =>
    lists
      .filter(({ items }) => items.length)
      .map(({ list, items }) => `${COMPACT_LABELS[list]}: ${items.join("; ")}`)
      .join("\n");

  let text = render();
  while (text.length > COMPACT_MEMORY_CHARS) {
    const longest = lists.reduce((a, b) => (b.items.length > a.items.length ? b : a));
    longest.items.pop();
    text = render();
  }
  return text || undefined;
}
