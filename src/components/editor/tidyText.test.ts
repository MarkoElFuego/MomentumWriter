import { describe, expect, it } from "vitest";
import { getSchema, type JSONContent } from "@tiptap/react";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { contentExtensions } from "./contentSchema";
import { tidyBlocks, tidyTr } from "./tidyText";

const schema = getSchema([...contentExtensions("sr-Latn")]);

const t = (text: string, marks?: string[]): JSONContent =>
  marks ? { type: "text", text, marks: marks.map((type) => ({ type })) } : { type: "text", text };
const p = (...content: (JSONContent | string)[]): JSONContent => ({
  type: "paragraph",
  content: content.map((part) => (typeof part === "string" ? t(part) : part)),
});
const empty: JSONContent = { type: "paragraph" };
const br: JSONContent = { type: "hardBreak" };
const texts = (blocks: JSONContent[]) =>
  blocks.map((block) => (block.content ?? []).map((node) => node.text ?? (node.type === "footnoteRef" ? "¹" : "")).join(""));

describe("tidyBlocks — spaces and indentation", () => {
  it("removes indentation, tabs and double spaces", () => {
    expect(texts(tidyBlocks([p("    Kiša je  padala\tcelu   noć.   ")]))).toEqual(["Kiša je padala celu noć."]);
  });

  it("collapses a double space across bold and italic, keeping the marks", () => {
    const [block] = tidyBlocks([p("Petar ", t(" je stigao ", ["bold"]), t("  kasno.", ["italic"]))]);
    expect(block!.content).toEqual([t("Petar "), t("je stigao ", ["bold"]), t("kasno.", ["italic"])]);
  });

  it("removes soft hyphens but keeps the no-break space", () => {
    expect(texts(tidyBlocks([p("raz­mi­šlja o tome")]))).toEqual(["razmišlja o tome"]);
  });
});

describe("tidyBlocks — empty lines", () => {
  it("drops empty paragraphs and keeps the scene break", () => {
    const blocks = tidyBlocks([p("Prvi."), empty, p("   "), { type: "sceneBreak" }, empty, p("Drugi.")]);
    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "sceneBreak", "paragraph"]);
  });

  it("never returns nothing", () => {
    expect(tidyBlocks([empty, p("  ")])).toEqual([{ type: "paragraph" }]);
  });
});

describe("tidyBlocks — paragraphs split line by line", () => {
  it("turns Shift+Enter breaks into spaces and joins a hyphenated word", () => {
    expect(texts(tidyBlocks([p("Kiša je padala ", br, "  celu noć, a Petar je rastav-", br, "ljao kofer.")]))).toEqual([
      "Kiša je padala celu noć, a Petar je rastavljao kofer.",
    ]);
  });

  it("joins PDF lines that continue a sentence", () => {
    const blocks = tidyBlocks([p("Kiša je padala celu"), p("noć, a Petar je čekao"), p("na pragu."), p("Mara je ćutala.")]);
    expect(texts(blocks)).toEqual(["Kiša je padala celu noć, a Petar je čekao na pragu.", "Mara je ćutala."]);
  });

  it("joins a word hyphenated at the end of a PDF line", () => {
    expect(texts(tidyBlocks([p("Petar je rastav-"), p("ljao kofer.")]))).toEqual(["Petar je rastavljao kofer."]);
  });

  it("does not join after a sentence, before dialogue, a capital letter or a heading", () => {
    const blocks = tidyBlocks([
      p("Došao je."),
      p("i otišao."),
      p("Rekao je"),
      p("— Dolazim."),
      p("Pogledao je"),
      p("Maru."),
      p("Stigli su"),
      { type: "heading", attrs: { level: 2 }, content: [t("deo drugi")] },
    ]);
    expect(blocks).toHaveLength(8);
  });

  it("keeps the alignment of the first part", () => {
    const [block] = tidyBlocks([
      { ...p("Kiša je padala celu"), attrs: { textAlign: "justify" } },
      { ...p("noć."), attrs: { textAlign: "center" } },
    ]);
    expect(block).toMatchObject({ attrs: { textAlign: "justify" }, content: [t("Kiša je padala celu noć.")] });
  });
});

describe("tidyBlocks — foreign formatting", () => {
  it("turns lists (nested too) into paragraphs", () => {
    const list: JSONContent = {
      type: "bulletList",
      content: [
        { type: "listItem", content: [p("Prvo.")] },
        {
          type: "listItem",
          content: [p("Drugo."), { type: "orderedList", content: [{ type: "listItem", content: [p("Treće.")] }] }],
        },
      ],
    };
    const blocks = tidyBlocks([list]);
    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "paragraph", "paragraph"]);
    expect(texts(blocks)).toEqual(["Prvo.", "Drugo.", "Treće."]);
  });

  it("removes strike and underline, keeps bold, italic, headings and quotes", () => {
    const blocks = tidyBlocks([
      p(t("precrtano", ["strike"]), " i ", t("podvučeno", ["underline"]), " i ", t("jako", ["bold", "italic"])),
      { type: "heading", attrs: { level: 1 }, content: [t("  Kofer ")] },
      { type: "blockquote", content: [p("  Citat."), empty] },
    ]);
    expect(blocks[0]!.content).toEqual([t("precrtano i podvučeno i "), t("jako", ["bold", "italic"])]);
    expect(blocks[1]).toEqual({ type: "heading", attrs: { level: 1 }, content: [t("Kofer")] });
    expect(blocks[2]).toEqual({ type: "blockquote", content: [p("Citat.")] });
  });

  it("keeps a footnote number with its id", () => {
    const ref: JSONContent = { type: "footnoteRef", attrs: { id: "n1" } };
    const [block] = tidyBlocks([p("Kiša  ", ref, "  pada.")]);
    expect(block!.content).toEqual([t("Kiša "), ref, t(" pada.")]);
  });

  it("leaves tidy text exactly as it was", () => {
    const blocks = [p("Kiša je padala."), { type: "sceneBreak" }, p("Petar ", t("je", ["bold"]), " stigao.")];
    expect(tidyBlocks(blocks)).toEqual(blocks);
  });
});

describe("tidyTr", () => {
  function stateWith(content: JSONContent[], from = 1, to = from): EditorState {
    const doc = schema.nodeFromJSON({ type: "doc", content });
    return EditorState.create({ doc, selection: TextSelection.create(doc, from, to) });
  }
  const paragraphs = (state: EditorState) => {
    const out: string[] = [];
    state.doc.forEach((node) => out.push(node.type.name === "footnotes" ? `[${node.textContent}]` : node.textContent));
    return out;
  };

  it("tidies the whole main text without a selection, in one step", () => {
    const state = stateWith([p("  Kiša je"), p("padala."), empty, p("Kraj.  ")]);
    const tr = tidyTr(state)!;
    expect(tr.steps).toHaveLength(1);
    expect(paragraphs(state.apply(tr))).toEqual(["Kiša je padala.", "Kraj."]);
  });

  it("tidies only the selected blocks", () => {
    const state = stateWith([p("  Prvi  "), p("  Drugi  "), p("  Treći  ")]);
    // From inside the second paragraph to inside the third.
    const second = state.doc.child(0).nodeSize + 3;
    const third = second + state.doc.child(1).nodeSize;
    const next = state.apply(tidyTr(state.apply(state.tr.setSelection(TextSelection.create(state.doc, second, third))))!);
    expect(paragraphs(next)).toEqual(["  Prvi  ", "Drugi", "Treći"]);
  });

  it("never touches the footnote zone and keeps the number linked", () => {
    const state = stateWith([
      p("Kiša  ", { type: "footnoteRef", attrs: { id: "n1" } }, " pada."),
      { type: "footnotes", content: [{ type: "footnote", attrs: { id: "n1" }, content: [t("  Beleška  sa razmacima ")] }] },
    ]);
    const next = state.apply(tidyTr(state)!);
    // "Kiša ¹ pada." — the number has no text of its own, so one space on each side of it.
    expect(paragraphs(next)).toEqual(["Kiša  pada.", "[  Beleška  sa razmacima ]"]);
    expect(next.doc.child(0).childCount).toBe(3);
    let id: unknown;
    next.doc.descendants((node) => {
      if (node.type.name === "footnoteRef") id = node.attrs.id;
    });
    expect(id).toBe("n1");
  });

  it("does nothing on tidy text or with the cursor in a footnote", () => {
    expect(tidyTr(stateWith([p("Kiša je padala.")]))).toBeNull();
    const withNote = stateWith([
      p("  Kiša."),
      { type: "footnotes", content: [{ type: "footnote", attrs: { id: "n1" }, content: [t("Beleška")] }] },
    ]);
    const inNote = withNote.doc.child(0).nodeSize + 3;
    expect(tidyTr(withNote.apply(withNote.tr.setSelection(TextSelection.create(withNote.doc, inNote))))).toBeNull();
  });
});
