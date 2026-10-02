import { describe, expect, it, vi } from "vitest";
import { getSchema } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { ProofResult } from "@/lib/db/proofCache";
import { Footnotes, footnotesPlugin } from "./footnotes";
import { proofChangeFor, resolveProof, visibleEdits, languageStats, type ProofSources } from "./proofCheck";
import {
  acceptDiacriticsTr,
  acceptProofTr,
  markRanges,
  openProofAtCursorTr,
  openProofMark,
  paragraphText,
  proofMarkCounts,
  proofMarksPlugin,
  rejectProofTr,
  setProofMarksTr,
} from "./proofMarks";

const schema = getSchema([StarterKit.configure({ document: false }), Footnotes]);

const ORIGINAL = "Cuo je da je otisao u skolu.";
const CORRECTED = "Čuo je da je otišao u školu.";

function start(text = ORIGINAL): EditorState {
  const doc = schema.nodes.doc!.create(null, schema.nodes.paragraph!.create(null, schema.text(text)));
  return EditorState.create({ doc, plugins: [footnotesPlugin, proofMarksPlugin] });
}

const textOf = (state: EditorState) => paragraphText(state.doc.firstChild!).text;

// Underlines for the first paragraph from a saved result — what useProofread does.
function withMarks(state: EditorState, result: ProofResult): EditorState {
  const node = state.doc.firstChild!;
  const marks = markRanges(node, 0, visibleEdits(paragraphText(node).text, result));
  return state.apply(setProofMarksTr(state, 0, node.nodeSize, marks));
}

// The id of the underline on `word`.
function markId(state: EditorState, word: string): number {
  const pos = 1 + textOf(state).indexOf(word) + 1;
  const moved = state.apply(state.tr.setSelection(TextSelection.create(state.doc, pos)));
  return openProofMark(moved.apply(openProofAtCursorTr(moved)!))!.id;
}

function sources(memory = new Map<string, ProofResult>(), saved = new Map<string, ProofResult>()) {
  const request = vi.fn<ProofSources["request"]>(async () => ({ ok: true, corrected: CORRECTED }));
  const save = vi.fn<ProofSources["save"]>(async (text, result) => {
    saved.set(text, result);
  });
  const all: ProofSources = { memory, lookup: async (text) => saved.get(text), save, request };
  return { all, request, save, saved, memory };
}

const signal = new AbortController().signal;

describe("resolveProof — memory, then saved, then the API", () => {
  it("asks the API once and saves the answer", async () => {
    const s = sources();
    const first = await resolveProof(ORIGINAL, s.all, signal);
    expect(first).toEqual({ result: { corrected: CORRECTED, rejected: [] }, fromApi: true });
    expect(s.saved.get(ORIGINAL)).toEqual({ corrected: CORRECTED, rejected: [] });

    // Reopening the chapter: a new session (empty memory), the saved result is used.
    const reopened = sources(new Map(), s.saved);
    expect(await resolveProof(ORIGINAL, reopened.all, signal)).toMatchObject({ fromApi: false });
    expect(reopened.request).not.toHaveBeenCalled();
  });

  it("remembers a paragraph the server rejected, so it is never sent again", async () => {
    const s = sources();
    s.request.mockResolvedValueOnce({ ok: false, retry: false });
    expect(await resolveProof(ORIGINAL, s.all, signal)).toEqual({ result: { corrected: null, rejected: [] }, fromApi: true });
    await resolveProof(ORIGINAL, sources(new Map(), s.saved).all, signal);
    expect(s.request).toHaveBeenCalledTimes(1);
    expect(visibleEdits(ORIGINAL, { corrected: null, rejected: [] })).toEqual([]);
  });

  it("does not save a network failure — the next try asks again", async () => {
    const s = sources();
    s.request.mockResolvedValueOnce({ ok: false, retry: true });
    expect(await resolveProof(ORIGINAL, s.all, signal)).toEqual({ retry: true });
    expect(s.save).not.toHaveBeenCalled();
  });
});

describe("Prihvati / Odbaci keep the saved check in step", () => {
  const result: ProofResult = { corrected: CORRECTED, rejected: [] };

  it("accepting one of three corrections needs no API call and leaves two underlines", async () => {
    const s = sources(new Map([[ORIGINAL, result]]));
    let state = withMarks(start(), result);
    expect(proofMarkCounts(state)).toEqual({ diacritics: 3, grammar: 0 });

    const tr = acceptProofTr(state, markId(state, "otisao"))!;
    state = state.apply(tr);
    expect(textOf(state)).toBe("Cuo je da je otišao u skolu.");
    expect(proofMarkCounts(state)).toEqual({ diacritics: 2, grammar: 0 });

    const change = proofChangeFor(tr, (text) => s.memory.get(text))!;
    expect(change).toEqual({ text: "Cuo je da je otišao u skolu.", result });
    s.memory.set(change.text, change.result);

    // The cursor leaves the paragraph → it is "checked" again, from memory.
    const again = await resolveProof(change.text, s.all, signal);
    expect(s.request).not.toHaveBeenCalled();
    expect("result" in again && visibleEdits(change.text, again.result).map((e) => e.from)).toEqual(["Cuo", "skolu."]);
  });

  it("a rejected correction is remembered and not offered again", () => {
    const memory = new Map([[ORIGINAL, result]]);
    const state = withMarks(start(), result);
    const tr = rejectProofTr(state, markId(state, "skolu"));
    const change = proofChangeFor(tr, (text) => memory.get(text))!;
    expect(change.text).toBe(ORIGINAL);
    expect(change.result.rejected).toEqual([{ from: "skolu.", to: "školu.", start: 22 }]);

    // Reopened: the underlines come from the saved result, without the rejected one.
    const reopened = withMarks(start(), change.result);
    expect(proofMarkCounts(reopened)).toEqual({ diacritics: 2, grammar: 0 });
  });

  it("a rejection moves with the text when an earlier word is accepted", () => {
    const memory = new Map<string, ProofResult>([[ORIGINAL, result]]);
    let state = withMarks(start(), result);
    const reject = rejectProofTr(state, markId(state, "skolu"));
    const rejected = proofChangeFor(reject, (text) => memory.get(text))!;
    memory.set(rejected.text, rejected.result);
    state = state.apply(reject);

    // "Cuo" → "Čuo" keeps the length; "otisao" → "otišao" too — use accept-all for both.
    const acceptAll = acceptDiacriticsTr(state, markId(state, "Cuo"))!;
    state = state.apply(acceptAll);
    const carried = proofChangeFor(acceptAll, (text) => memory.get(text))!;
    expect(carried.text).toBe("Čuo je da je otišao u skolu.");
    expect(carried.result.rejected).toEqual([{ from: "skolu.", to: "školu.", start: 22 }]);
    expect(visibleEdits(carried.text, carried.result)).toEqual([]);
  });

  it("a rejection shifts when an accepted word before it gets shorter", () => {
    const text = "Kad dodje kuci, cuo je.";
    const saved: ProofResult = { corrected: "Kad dođe kući, čuo je.", rejected: [] };
    const memory = new Map<string, ProofResult>([[text, saved]]);
    let state = withMarks(start(text), saved);

    const reject = rejectProofTr(state, markId(state, "cuo"));
    const rejected = proofChangeFor(reject, (t) => memory.get(t))!;
    expect(rejected.result.rejected).toEqual([{ from: "cuo", to: "čuo", start: 16 }]);
    memory.set(rejected.text, rejected.result);
    state = state.apply(reject);

    const accept = acceptProofTr(state, markId(state, "dodje"))!;
    state = state.apply(accept);
    const carried = proofChangeFor(accept, (t) => memory.get(t))!;
    expect(carried.text).toBe("Kad dođe kuci, cuo je.");
    // One letter shorter before it: 16 → 15, still pointing at "cuo".
    expect(carried.result.rejected).toEqual([{ from: "cuo", to: "čuo", start: 15 }]);
    expect(carried.text.slice(15, 18)).toBe("cuo");
    expect(visibleEdits(carried.text, carried.result).map((e) => e.from)).toEqual(["kuci,"]);
  });

  it("does nothing for a paragraph without a saved check", () => {
    const state = withMarks(start(), result);
    expect(proofChangeFor(acceptProofTr(state, markId(state, "Cuo"))!, () => undefined)).toBeNull();
  });
});

describe("languageStats", () => {
  it("counts only checked paragraphs' words, and the open underlines", () => {
    const doc = schema.nodes.doc!.create(null, [
      schema.nodes.paragraph!.create(null, schema.text(ORIGINAL)),
      schema.nodes.paragraph!.create(null, schema.text("Ovaj pasus još nije proveren.")),
    ]);
    let state = EditorState.create({ doc, plugins: [footnotesPlugin, proofMarksPlugin] });
    state = withMarks(state, { corrected: CORRECTED, rejected: [] });
    expect(languageStats(state, (text) => text === ORIGINAL)).toEqual({
      totalWords: 7 + 5,
      counts: { words: 7, diacritics: 3, grammar: 0 },
    });
  });
});
