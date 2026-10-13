import { beforeEach, describe, expect, it, vi } from "vitest";
import { importBook } from "@/lib/db/importBook";
import { getBook } from "@/lib/db/books";
import { db } from "@/lib/db/schema";
import { textToBlocks } from "@/lib/import/fromText";
import { splitBook } from "@/lib/import/splitBook";
import { continueImportReading } from "./importReading";
import { updateStoryMemory, type MemoryUpdate } from "./updateMemory";

vi.mock("./updateMemory", () => ({ updateStoryMemory: vi.fn() }));
const read = vi.mocked(updateStoryMemory);

const parts = () => splitBook(textToBlocks(["1", "Prvo.", "2", "Drugo.", "3", "Treće."].join("\n"))).parts;

beforeEach(async () => {
  await db.delete();
  await db.open();
  read.mockReset();
});

describe("continueImportReading", () => {
  it("reads every part in book order, one at a time, then forgets the reading", async () => {
    const order: string[] = [];
    let active = 0;
    read.mockImplementation(async (partId) => {
      active++;
      expect(active).toBe(1);
      order.push(partId);
      await Promise.resolve();
      active--;
      return "updated";
    });
    const { book } = await importBook({ title: "Kiša", parts: parts(), tironReads: true });
    const ids = book.importReading!.partIds;
    expect(ids).toHaveLength(3);

    await continueImportReading(book.id);
    expect(order).toEqual(ids);
    expect(read).toHaveBeenCalledWith(ids[0], { force: true });
    expect((await getBook(book.id))?.importReading).toBeUndefined();
    // Reading is not writing: no whisper, no session.
    expect(await db.whispers.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
  });

  it("stops when Tiron can't read and goes on from there next time", async () => {
    const results: MemoryUpdate[] = ["updated", "failed"];
    read.mockImplementation(async () => results.shift() ?? "updated");
    const { book } = await importBook({ title: "Kiša", parts: parts(), tironReads: true });

    await continueImportReading(book.id);
    expect((await getBook(book.id))?.importReading?.done).toBe(1);

    await continueImportReading(book.id);
    expect(read).toHaveBeenLastCalledWith(book.importReading!.partIds[2], { force: true });
    expect((await getBook(book.id))?.importReading).toBeUndefined();
  });

  it("without „Neka Tiron pročita knjigu” nothing is read", async () => {
    const { book } = await importBook({ title: "Kiša", parts: parts(), tironReads: false });
    expect(book.importReading).toBeUndefined();
    await continueImportReading(book.id);
    expect(read).not.toHaveBeenCalled();
  });
});
