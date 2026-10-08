import { beforeEach, describe, expect, it } from "vitest";
import { createBook, deleteBook, renameBook } from "./books";
import { bookToMarkdown, bookToPrint } from "./exportBook";
import { createPart, deletePart, renamePart, savePart } from "./parts";
import { db } from "./schema";

const withNote = (words: string, id: string, note: string) => ({
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: words }, { type: "footnoteRef", attrs: { id } }] },
    { type: "footnotes", content: [{ type: "footnote", attrs: { id }, content: [{ type: "text", text: note }] }] },
  ],
});

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("bookToMarkdown", () => {
  it("writes every live part in book order, footnotes numbered through the book", async () => {
    const { book, part: first } = await createBook();
    await renameBook(book.id, "Kiša");
    await renamePart(first.id, "Dolazak");
    await savePart(first.id, withNote("Pada kiša.", "a", "Prva."), 2, "2026-10-07");

    const second = await createPart(book.id, "chapter");
    await savePart(second.id, withNote("Stao je.", "b", "Druga."), 2, "2026-10-07");
    const gone = await createPart(book.id, "chapter", "Obrisano");
    await deletePart(gone.id);
    const preface = await createPart(book.id, "front", "Predgovor");
    await savePart(preface.id, { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Uvod." }] }] }, 1, "2026-10-07");

    expect((await bookToMarkdown(book.id))?.markdown).toBe(
      [
        "# Kiša",
        "## Predgovor",
        "Uvod.",
        "## Poglavlje I · Dolazak",
        "Pada kiša.[^1]",
        "[^1]: Prva.",
        "## Poglavlje II",
        "Stao je.[^2]",
        "[^2]: Druga.",
      ].join("\n\n") + "\n",
    );
  });

  it("keeps the heading of a part without text and returns nothing for a deleted book", async () => {
    const { book } = await createBook();
    expect((await bookToMarkdown(book.id))?.markdown).toBe("# Nova knjiga\n\n## Poglavlje I\n");
    await deleteBook(book.id);
    expect(await bookToMarkdown(book.id)).toBeUndefined();
  });
});

const prose = (value: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: value }] }] });

describe("bookToPrint", () => {
  it("puts „Naslovna” on the title page, marks the dedication and skips parts without text", async () => {
    const { book, part: first } = await createBook();
    await renameBook(book.id, "Kiša");
    await renamePart(first.id, "Dolazak");
    await savePart(first.id, withNote("Pada kiša.", "a", "Prva."), 2, "2026-10-08");
    const empty = await createPart(book.id, "chapter");
    const third = await createPart(book.id, "chapter");
    await savePart(third.id, withNote("Stao je.", "b", "Druga."), 2, "2026-10-08");
    const cover = await createPart(book.id, "front", "Naslovna");
    await savePart(cover.id, prose("Ana Petrović"), 2, "2026-10-08");
    const dedication = await createPart(book.id, "front", "Posveta");
    await savePart(dedication.id, prose("Mami."), 1, "2026-10-08");
    await createPart(book.id, "back", "Zahvalnica");

    const print = await bookToPrint(book.id);
    expect(print?.title).toBe("Kiša");
    expect(print?.titlePage).toBe("<p>Ana Petrović</p>");
    expect(print?.sections.map(({ role, label, title, firstNote, notes }) => ({ role, label, title, firstNote, notes }))).toEqual([
      { role: "dedication", label: undefined, title: "Posveta", firstNote: 1, notes: [] },
      { role: "part", label: "Poglavlje I", title: "Dolazak", firstNote: 1, notes: ["Prva."] },
      // The empty chapter II is left out; numbers stay as in the editor.
      { role: "part", label: "Poglavlje III", title: "", firstNote: 2, notes: ["Druga."] },
    ]);
    expect(print?.sections.some((s) => s.id === empty.id)).toBe(false);
  });

  it("returns nothing for a deleted book", async () => {
    const { book } = await createBook();
    await deleteBook(book.id);
    expect(await bookToPrint(book.id)).toBeUndefined();
  });
});
