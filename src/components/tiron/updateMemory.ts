import { docFromJSON } from "@/components/editor/contentSchema";
import { mainTextEnd } from "@/components/editor/footnotes";
import { MEMORY_CHAPTER_WORDS } from "@/lib/ai/memory";
import { requestMemory } from "@/lib/ai/sparkClient";
import { getBook } from "@/lib/db/books";
import { applyMemoryResult, getMemory, needsMemoryUpdate } from "@/lib/db/memory";
import { chapterNumber, getPart, listParts, partHeading } from "@/lib/db/parts";
import { MEMORY_LISTS, type ID, type StoryMemory } from "@/lib/db/schema";
import { countWords } from "@/lib/text/countWords";
import { extractContext } from "@/lib/text/extractContext";
import { hashText } from "@/lib/text/hash";

export type MemoryUpdate = "updated" | "unchanged" | "empty" | "failed";

// A part being read is not sent again: leaving it and „Osveži” at once share one request.
const reading = new Map<ID, Promise<MemoryUpdate>>();

function lists(memory: StoryMemory, pinned: boolean) {
  const pick = (list: (typeof MEMORY_LISTS)[number]) =>
    memory[list].filter((item) => item.pinned === pinned).map((item) => item.text);
  return { characters: pick("characters"), places: pick("places"), openThreads: pick("openThreads") };
}

/**
 * Tiron reads one part in the background (T2). It reads the saved part from
 * Dexie, so it works after the editor is gone — the caller flushes autosave first.
 * Without `force` it only reads after MEMORY_NEW_WORDS new words; a text it
 * already read is never sent again.
 */
export function updateStoryMemory(partId: ID, options: { force?: boolean } = {}): Promise<MemoryUpdate> {
  const pending = reading.get(partId);
  if (pending) return pending;
  const run = readPart(partId, options.force ?? false).finally(() => reading.delete(partId));
  reading.set(partId, run);
  return run;
}

async function readPart(partId: ID, force: boolean): Promise<MemoryUpdate> {
  try {
    const part = await getPart(partId);
    const book = part && (await getBook(part.bookId));
    if (!part || !book) return "empty";

    const doc = docFromJSON(part.content, book.language);
    const end = mainTextEnd(doc);
    const full = doc.textBetween(0, end, "\n\n");
    if (countWords(full) === 0) return "empty";
    const hash = hashText(full);
    if (hash === part.summaryForHash) return "unchanged";
    if (!force && !needsMemoryUpdate(part, hash)) return "unchanged";

    const [memory, parts] = await Promise.all([getMemory(book.id), listParts(book.id)]);
    const result = await requestMemory({
      mode: "memory",
      text: extractContext(doc, end, MEMORY_CHAPTER_WORDS),
      memory: lists(memory, false),
      pinned: lists(memory, true),
      bookTitle: book.title,
      chapterTitle: partHeading(part, chapterNumber(parts, part.id)),
      language: book.language,
      ...(book.genre ? { genre: book.genre } : {}),
    });
    if (!result.ok) {
      console.warn(`[memory] kept the old memory (${result.status})`);
      return "failed";
    }
    await applyMemoryResult(book.id, { partId, hash, words: part.wordCount }, result.data);
    return "updated";
  } catch (error) {
    console.error("[memory] update failed", error);
    return "failed";
  }
}
