import { getBook } from "@/lib/db/books";
import { markImportRead } from "@/lib/db/importBook";
import type { ID } from "@/lib/db/schema";
import { updateStoryMemory } from "./updateMemory";

// Uvoz (I3): „Neka Tiron pročita knjigu” — after an import Tiron reads the book
// part by part with his usual reading (T2), one request at a time, so he knows
// the characters, places and open threads before the author writes on. No
// chapter-end whisper comes from it (T5 whispers only when the author leaves a
// part). Where he stopped is in Dexie: a closed tab goes on at the next opening.

const running = new Set<ID>();

export async function continueImportReading(bookId: ID): Promise<void> {
  if (running.has(bookId)) return;
  running.add(bookId);
  try {
    for (;;) {
      const reading = (await getBook(bookId))?.importReading;
      const partId = reading?.partIds[reading.done];
      if (!reading || !partId) return;
      // A part Tiron already read (unchanged text) counts as read; "empty" is a part left without text.
      const result = await updateStoryMemory(partId, { force: true });
      // No AI or no network: stop here and try again next time the book is opened.
      if (result === "failed") return;
      await markImportRead(bookId, reading.done + 1);
    }
  } catch (error) {
    console.error("[memory] import reading stopped", error);
  } finally {
    running.delete(bookId);
  }
}
