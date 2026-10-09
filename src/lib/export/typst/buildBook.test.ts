import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/react";
import type { Book, Part, PartKind } from "@/lib/db/schema";
import { buildBook, hasText } from "./buildBook";

const prose = (value: string): JSONContent => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
});
const EMPTY: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

const book: Book = { id: "b", title: "Kiša", language: "sr-Latn", createdAt: 0, updatedAt: 0, genre: "triler" };

let order = 0;
function part(kind: PartKind, title: string, content: JSONContent, extra: Partial<Part> = {}): Part {
  order += 1000;
  return { id: `${kind}-${order}`, bookId: "b", kind, title, order, content, wordCount: 2, createdAt: 0, updatedAt: 0, ...extra };
}

describe("buildBook", () => {
  it("orders parts, skips empty and deleted ones and keeps the editor's chapter numbers", () => {
    const parts = [
      part("back", "Zahvalnica", prose("Hvala.")),
      part("chapter", "Dolazak", prose("Pada kiša.")),
      part("chapter", "", EMPTY),
      part("chapter", "Obrisano", prose("x"), { deletedAt: 1 }),
      part("chapter", "", prose("Stao je.")),
      part("front", "Predgovor", prose("Uvod.")),
      part("front", "Posveta", prose("Mami.")),
      part("front", "Naslovna", prose("Ana Petrović")),
      part("chapter", "Tuđa", prose("x"), { bookId: "drugi" }),
    ];
    const result = buildBook(book, parts);
    expect(result.sections.map(({ kind, role, number, title, body }) => ({ kind, role, number, title, body }))).toEqual([
      { kind: "front", role: "part", number: undefined, title: "Predgovor", body: "Uvod\\." },
      { kind: "front", role: "dedication", number: undefined, title: "Posveta", body: "Mami\\." },
      { kind: "front", role: "titlePage", number: undefined, title: "Naslovna", body: "Ana Petrović" },
      { kind: "chapter", role: "part", number: 1, title: "Dolazak", body: "Pada kiša\\." },
      // Chapter II is empty: left out, but III keeps its number.
      { kind: "chapter", role: "part", number: 3, title: "", body: "Stao je\\." },
      { kind: "back", role: "part", number: undefined, title: "Zahvalnica", body: "Hvala\\." },
    ]);
    expect(result).toMatchObject({ title: "Kiša", language: "sr-Latn", genre: "triler", wordCount: 14 });
  });

  it("names an untitled book and an untitled front part", () => {
    const result = buildBook({ ...book, title: "  " }, [part("front", "", prose("Tekst."))]);
    expect(result.title).toBe("Nova knjiga");
    expect(result.sections[0]?.title).toBe("Bez naslova");
  });
});

describe("hasText", () => {
  it("is false for empty documents, whitespace and footnotes alone", () => {
    expect(hasText(EMPTY)).toBe(false);
    expect(hasText(prose("   "))).toBe(false);
    expect(
      hasText({ type: "doc", content: [{ type: "paragraph" }, { type: "footnotes", content: [{ type: "footnote", content: [{ type: "text", text: "x" }] }] }] }),
    ).toBe(false);
  });

  it("is true for text or a scene break", () => {
    expect(hasText(prose("Mami."))).toBe(true);
    expect(hasText({ type: "doc", content: [{ type: "sceneBreak" }] })).toBe(true);
  });
});
