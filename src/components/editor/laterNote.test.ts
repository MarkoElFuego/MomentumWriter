import { describe, expect, it } from "vitest";
import { getSchema, type JSONContent } from "@tiptap/react";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { contentExtensions, docFromJSON } from "./contentSchema";
import {
  addLaterNoteTr,
  goToLaterNoteTr,
  laterNoteAtCursor,
  laterNoteRangeAt,
  laterNoteRanges,
  laterNotesIn,
  removeLaterNoteTr,
  updateLaterNoteTr,
} from "./laterNote";
import { tidyBlocks } from "./tidyText";

const schema = getSchema([...contentExtensions("sr-Latn")]);
const p = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });
const note = (id: string, text: string) => ({ type: "laterNote", attrs: { id, note: text, createdAt: 5 } });

function stateWith(content: JSONContent[], from: number, to = from): EditorState {
  const doc = schema.nodeFromJSON({ type: "doc", content });
  return EditorState.create({ doc, selection: TextSelection.create(doc, from, to) });
}
const marked = (state: EditorState) => {
  const out: string[] = [];
  state.doc.descendants((node) => {
    if (node.marks.some((mark) => mark.type.name === "laterNote")) out.push(node.text ?? "");
  });
  return out;
};

describe("laterNote — where a note goes", () => {
  it("on the selection", () => {
    // "Kiša je padala." — select "je padala".
    expect(laterNoteRangeAt(stateWith([p("Kiša je padala.")], 6, 15))).toEqual({ from: 6, to: 15 });
  });

  it("without a selection on the word at the cursor, or the one just before it", () => {
    const text = [p("Kiša je padala celu noć.")];
    // Inside "padala".
    expect(laterNoteRangeAt(stateWith(text, 11))).toEqual({ from: 9, to: 15 });
    // Right after "padala".
    expect(laterNoteRangeAt(stateWith(text, 15))).toEqual({ from: 9, to: 15 });
    // After "padala " (the space) → still the word before.
    expect(laterNoteRangeAt(stateWith([p("Kiša je padala ")], 16))).toEqual({ from: 9, to: 15 });
  });

  it("nowhere in an empty line or a footnote", () => {
    expect(laterNoteRangeAt(stateWith([{ type: "paragraph" }], 1))).toBeNull();
    expect(laterNoteRangeAt(stateWith([p("   ")], 3))).toBeNull();
    const withNote = stateWith(
      [p("Kiša."), { type: "footnotes", content: [{ type: "footnote", attrs: { id: "f1" }, content: [{ type: "text", text: "Beleška" }] }] }],
      1,
    );
    const inNote = withNote.doc.child(0).nodeSize + 3;
    expect(laterNoteRangeAt(withNote.apply(withNote.tr.setSelection(TextSelection.create(withNote.doc, inNote))))).toBeNull();
  });
});

describe("laterNote — add, change, tick off", () => {
  it("adds a note in one step; an empty note adds nothing", () => {
    const state = stateWith([p("Kiša je padala.")], 11);
    const range = laterNoteRangeAt(state)!;
    expect(addLaterNoteTr(state, range, "   ")).toBeNull();
    const tr = addLaterNoteTr(state, range, "  Preslabo — pojačaj kišu.  ", 7, "n1")!;
    expect(tr.steps).toHaveLength(1);
    const next = state.apply(tr);
    expect(marked(next)).toEqual(["padala"]);
    expect(laterNotesIn(next.doc)).toEqual([{ id: "n1", note: "Preslabo — pojačaj kišu.", createdAt: 7, text: "padala" }]);
  });

  it("finds the note at the cursor and changes its text everywhere", () => {
    const state = stateWith(
      [
        { type: "paragraph", content: [{ type: "text", text: "Kiša ", marks: [note("n1", "Staro")] }] },
        { type: "paragraph", content: [{ type: "text", text: "pada", marks: [note("n1", "Staro")] }] },
      ],
      2,
    );
    expect(laterNoteAtCursor(state)).toEqual({ id: "n1", note: "Staro", createdAt: 5 });
    const next = state.apply(updateLaterNoteTr(state, "n1", "Novo")!);
    expect(laterNotesIn(next.doc)).toEqual([{ id: "n1", note: "Novo", createdAt: 5, text: "Kiša pada" }]);
  });

  it("ticking off removes every part of the note and keeps the text and bold", () => {
    const state = stateWith(
      [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Kiša ", marks: [note("n1", "a")] },
            { type: "text", text: "je", marks: [{ type: "bold" }, note("n1", "a")] },
            { type: "text", text: " pada", marks: [note("n2", "b")] },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "dalje", marks: [note("n1", "a")] }] },
      ],
      1,
    );
    expect(laterNoteRanges(state.doc, "n1")).toHaveLength(2);
    const next = state.apply(removeLaterNoteTr(state, "n1")!);
    expect(next.doc.textContent).toBe("Kiša je padadalje");
    expect(laterNotesIn(next.doc).map((entry) => entry.id)).toEqual(["n2"]);
    let bold = false;
    next.doc.descendants((node) => {
      if (node.text === "je") bold = node.marks.some((mark) => mark.type.name === "bold");
    });
    expect(bold).toBe(true);
    expect(removeLaterNoteTr(next, "n1")).toBeNull();
  });

  it("goes to a note with the cursor at its start, not selecting it", () => {
    const state = stateWith([p("Prvi."), { type: "paragraph", content: [{ type: "text", text: "Drugi", marks: [note("n1", "a")] }] }], 1);
    const next = state.apply(goToLaterNoteTr(state, "n1")!);
    expect(next.selection.empty).toBe(true);
    expect(next.selection.from).toBe(state.doc.child(0).nodeSize + 1);
  });
});

describe("laterNote — in saved content", () => {
  it("survives reading saved JSON (Resume, Tiron's memory) and the round trip", () => {
    const content = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Kiša", marks: [note("n1", "Pojačaj")] }] }],
    };
    const doc = docFromJSON(content, "sr-Latn");
    expect(doc.toJSON().content[0].content[0]).toEqual(content.content[0]!.content[0]);
    expect(laterNotesIn(doc)).toEqual([{ id: "n1", note: "Pojačaj", createdAt: 5, text: "Kiša" }]);
  });

  it("„Sredi tekst” keeps notes", () => {
    const block: JSONContent = {
      type: "paragraph",
      content: [{ type: "text", text: "  Kiša  ", marks: [note("n1", "Pojačaj")] }],
    };
    expect(tidyBlocks([block])).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Kiša", marks: [note("n1", "Pojačaj")] }] },
    ]);
  });
});
