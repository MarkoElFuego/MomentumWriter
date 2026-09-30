import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { closeHistory, history, undo } from "@tiptap/pm/history";
import type { Node as PMNode } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { Footnotes, footnotesPlugin, insertFootnoteTr, leaveFootnoteTr, mainTextEnd } from "./footnotes";

const schema = getSchema([StarterKit.configure({ document: false }), Footnotes]);

function start(text: string): EditorState {
  const doc = schema.nodes.doc!.create(null, schema.nodes.paragraph!.create(null, schema.text(text)));
  return EditorState.create({ doc, plugins: [history(), footnotesPlugin] });
}

// Puts the cursor right after `after` in the prose, adds a note and types into it.
function addNote(state: EditorState, after: string, text: string): EditorState {
  const pos = 1 + state.doc.textBetween(0, mainTextEnd(state.doc)).indexOf(after) + after.length;
  const moved = state.apply(state.tr.setSelection(TextSelection.create(state.doc, pos)));
  const inserted = moved.apply(closeHistory(insertFootnoteTr(moved)!));
  return inserted.apply(inserted.tr.insertText(text));
}

function notes(doc: PMNode): string[] {
  const zone = doc.lastChild?.type.name === "footnotes" ? doc.lastChild : null;
  const texts: string[] = [];
  zone?.forEach((note) => texts.push(note.textContent));
  return texts;
}

function refPositions(doc: PMNode): number[] {
  const positions: number[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "footnoteRef") positions.push(pos);
  });
  return positions;
}

function threeNotes(): EditorState {
  let state = start("Prva rečenica. Druga rečenica. Treća rečenica.");
  state = addNote(state, "Prva rečenica.", "jedan");
  state = addNote(state, "Druga rečenica.", "dva");
  return addNote(state, "Treća rečenica.", "tri");
}

describe("footnotes", () => {
  it("adds a note per mark and puts the cursor in it", () => {
    const state = threeNotes();
    expect(notes(state.doc)).toEqual(["jedan", "dva", "tri"]);
    expect(state.selection.$from.parent.type.name).toBe("footnote");
  });

  it("keeps notes in text order when a mark is added earlier", () => {
    let state = start("Alfa beta gama.");
    state = addNote(state, "gama.", "kasnije");
    state = addNote(state, "Alfa", "ranije");
    expect(notes(state.doc)).toEqual(["ranije", "kasnije"]);
  });

  it("deleting the middle mark drops its note; one undo brings both back", () => {
    const state = threeNotes();
    const middle = refPositions(state.doc)[1]!;
    const deleted = state.apply(closeHistory(state.tr.delete(middle, middle + 1)));
    expect(notes(deleted.doc)).toEqual(["jedan", "tri"]);
    expect(refPositions(deleted.doc)).toHaveLength(2);

    let restored = deleted;
    undo(deleted, (tr) => {
      restored = deleted.apply(tr);
    });
    expect(notes(restored.doc)).toEqual(["jedan", "dva", "tri"]);
    expect(refPositions(restored.doc)).toHaveLength(3);
  });

  it("removes the zone when the last mark is gone", () => {
    let state = addNote(start("Tekst."), "Tekst.", "beleška");
    const [ref] = refPositions(state.doc);
    state = state.apply(state.tr.delete(ref!, ref! + 1));
    expect(state.doc.lastChild?.type.name).toBe("paragraph");
    expect(state.doc.textContent).toBe("Tekst.");
  });

  it("a copied mark gets its own empty note", () => {
    let state = addNote(start("Tekst."), "Tekst.", "beleška");
    const [ref] = refPositions(state.doc);
    const copy = state.doc.nodeAt(ref!)!;
    state = state.apply(state.tr.insert(1, copy));
    expect(notes(state.doc)).toEqual(["", "beleška"]);
  });

  it("Esc goes back right after the note's number", () => {
    const state = threeNotes();
    const inSecond = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, mainTextEnd(state.doc) + 1 + "jedan".length + 2 + 1)),
    );
    expect(inSecond.selection.$from.parent.textContent).toBe("dva");
    const back = inSecond.apply(leaveFootnoteTr(inSecond)!);
    expect(back.selection.from).toBe(refPositions(back.doc)[1]! + 1);
  });

  it("does not insert a footnote inside a footnote", () => {
    expect(insertFootnoteTr(threeNotes())).toBeNull();
  });

  it("the number adds no text to the prose", () => {
    const state = threeNotes();
    expect(state.doc.textBetween(0, mainTextEnd(state.doc))).toBe(
      "Prva rečenica. Druga rečenica. Treća rečenica.",
    );
  });
});
