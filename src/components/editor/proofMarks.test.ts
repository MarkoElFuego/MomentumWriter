import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { closeHistory, history, undo } from "@tiptap/pm/history";
import type { Node as PMNode } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { proofDiff } from "@/lib/text/proofDiff";
import { Footnotes, footnotesPlugin } from "./footnotes";
import {
  acceptDiacriticsTr,
  acceptProofTr,
  hasProofMarks,
  markRanges,
  openProofAtCursorTr,
  openProofMark,
  paragraphText,
  proofMarksPlugin,
  rejectProofTr,
  setProofMarksTr,
} from "./proofMarks";

const schema = getSchema([StarterKit.configure({ document: false }), Footnotes]);
const { paragraph } = schema.nodes;

function start(...content: PMNode[]): EditorState {
  const doc = schema.nodes.doc!.create(null, paragraph!.create(null, content));
  return EditorState.create({ doc, plugins: [history(), footnotesPlugin, proofMarksPlugin] });
}

// Runs the proofreader's answer for the first paragraph through diff → marks.
function withMarks(state: EditorState, corrected: string): EditorState {
  const node = state.doc.firstChild!;
  const marks = markRanges(node, 0, proofDiff(paragraphText(node).text, corrected));
  return state.apply(setProofMarksTr(state, 0, node.nodeSize, marks));
}

function marksOf(state: EditorState) {
  const found: { text: string; to: string; type: string }[] = [];
  for (let pos = 1; pos < state.doc.content.size; pos++) {
    const at = state.apply(state.tr.setSelection(TextSelection.create(state.doc, pos)));
    const tr = openProofAtCursorTr(at);
    const mark = tr && openProofMark(at.apply(tr));
    if (mark && !found.some((f) => f.text === mark.edit.from)) {
      found.push({ text: state.doc.textBetween(mark.from, mark.to), to: mark.edit.to, type: mark.edit.type });
    }
  }
  return found;
}

function openAt(state: EditorState, word: string) {
  const pos = state.doc.textContent.indexOf(word) + 2;
  const at = state.apply(state.tr.setSelection(TextSelection.create(state.doc, pos)));
  return openProofMark(at.apply(openProofAtCursorTr(at)!))!;
}

describe("proofMarks", () => {
  it("underlines only the words that change", () => {
    const state = withMarks(start(schema.text("Cekao sam je ispred skole.")), "Čekao sam je ispred škole.");
    expect(marksOf(state)).toEqual([
      { text: "Cekao", to: "Čekao", type: "diacritic" },
      { text: "skole.", to: "škole.", type: "diacritic" },
    ]);
  });

  it("accepting replaces the word, keeps its formatting, and one undo brings it back", () => {
    const bold = schema.marks.bold!.create();
    let state = withMarks(
      start(schema.text("Bio je "), schema.text("cesto", [bold]), schema.text(" tu.")),
      "Bio je često tu.",
    );
    const mark = openAt(state, "cesto");
    state = state.apply(closeHistory(acceptProofTr(state, mark.id)!));
    expect(state.doc.textContent).toBe("Bio je često tu.");
    expect(state.doc.firstChild!.child(1).marks.map((m) => m.type.name)).toEqual(["bold"]);
    expect(hasProofMarks(state)).toBe(false);

    undo(state, (tr) => {
      state = state.apply(tr);
    });
    expect(state.doc.textContent).toBe("Bio je cesto tu.");
  });

  it("rejecting only removes the underline", () => {
    let state = withMarks(start(schema.text("Bio je cesto tu.")), "Bio je često tu.");
    state = state.apply(rejectProofTr(state, openAt(state, "cesto").id));
    expect(state.doc.textContent).toBe("Bio je cesto tu.");
    expect(hasProofMarks(state)).toBe(false);
  });

  it("a word the author edits loses its underline; others stay", () => {
    let state = withMarks(start(schema.text("Cekao sam ispred skole.")), "Čekao sam ispred škole.");
    state = state.apply(state.tr.insertText("x", 3));
    expect(marksOf(state).map((m) => m.to)).toEqual(["škole."]);
  });

  it("accepts all diacritics of the paragraph in one step, not grammar", () => {
    let state = withMarks(
      start(schema.text("Cekao sam o tvoj skole dugo.")),
      "Čekao sam o tvom škole dugo.",
    );
    const mark = openAt(state, "Cekao");
    expect(mark.diacriticsInParagraph).toBe(2);
    state = state.apply(closeHistory(acceptDiacriticsTr(state, mark.id)!));
    expect(state.doc.textContent).toBe("Čekao sam o tvoj škole dugo.");
    expect(marksOf(state).map((m) => m.to)).toEqual(["tvom"]);
    undo(state, (tr) => {
      state = state.apply(tr);
    });
    expect(state.doc.textContent).toBe("Cekao sam o tvoj skole dugo.");
  });

  it("never underlines a word that has a footnote number inside it", () => {
    const ref = schema.nodes.footnoteRef!.create({ id: "a" });
    const node = paragraph!.create(null, [schema.text("Bio je cesto"), ref, schema.text(", tu cesto.")]);
    const { text, atoms } = paragraphText(node);
    expect(text).toBe("Bio je cesto, tu cesto.");
    expect(atoms).toEqual([12]);
    const ranges = markRanges(node, 0, proofDiff(text, "Bio je često, tu često."));
    expect(ranges.map((r) => r.edit.to)).toEqual(["često."]);
  });

  it("a hard break separates words", () => {
    const node = paragraph!.create(null, [schema.text("prvi"), schema.nodes.hardBreak!.create(), schema.text("drugi")]);
    expect(paragraphText(node).text).toBe("prvi\ndrugi");
  });
});
