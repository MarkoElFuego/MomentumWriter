import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/react";
import { collectLaterNotes, stripLaterNote } from "./laterNotes";

const note = (id: string, text: string, createdAt = 1) => ({ type: "laterNote", attrs: { id, note: text, createdAt } });
const text = (value: string, marks?: JSONContent["marks"]): JSONContent => (marks ? { type: "text", text: value, marks } : { type: "text", text: value });

const content: JSONContent = {
  type: "doc",
  content: [
    { type: "paragraph", content: [text("Kiša ", [note("n1", "Pojačaj", 3)]), text("pada.")] },
    { type: "blockquote", content: [{ type: "paragraph", content: [text("Citat", [{ type: "italic" }, note("n2", "Proveri")])] }] },
    // Enter in the middle of the first note split it in two.
    { type: "paragraph", content: [text("dalje", [note("n1", "Pojačaj", 3)])] },
  ],
};

describe("collectLaterNotes", () => {
  it("lists notes in reading order, once each, also inside quotes", () => {
    expect(collectLaterNotes(content)).toEqual([
      { id: "n1", note: "Pojačaj", createdAt: 3, text: "Kiša dalje" },
      { id: "n2", note: "Proveri", createdAt: 1, text: "Citat" },
    ]);
  });

  it("finds nothing in text without notes", () => {
    expect(collectLaterNotes({ type: "doc", content: [{ type: "paragraph", content: [text("Kiša.")] }] })).toEqual([]);
  });
});

describe("stripLaterNote", () => {
  it("removes only that note's mark — text and other marks stay", () => {
    const stripped = stripLaterNote(content, "n1");
    expect(collectLaterNotes(stripped).map((entry) => entry.id)).toEqual(["n2"]);
    expect(stripped.content![0]!.content![0]).toEqual(text("Kiša "));
    expect(stripped.content![1]!.content![0]!.content![0]!.marks).toEqual([{ type: "italic" }, note("n2", "Proveri")]);
    // The original is not changed.
    expect(collectLaterNotes(content)).toHaveLength(2);
  });
});
