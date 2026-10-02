import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/react";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { contentExtensions } from "./contentSchema";
import { blockStyleAt, blockStyleShortcut, setBlockStyle, type BlockStyle } from "./blockStyle";

const schema = getSchema([...contentExtensions("sr-Latn")]);

function stateWith(content: object[], cursor = 3): EditorState {
  const doc = schema.nodeFromJSON({ type: "doc", content });
  return EditorState.create({ doc, selection: TextSelection.create(doc, cursor) });
}

function apply(state: EditorState, style: BlockStyle): EditorState {
  let next = state;
  setBlockStyle(style)(state, (tr) => (next = state.apply(tr)));
  return next;
}

const p = (text: string, attrs?: object) => ({ type: "paragraph", attrs, content: [{ type: "text", text }] });

describe("setBlockStyle", () => {
  it("turns text into headings and back", () => {
    const h1 = apply(stateWith([p("Kofer")]), "heading1");
    expect(h1.doc.firstChild?.type.name).toBe("heading");
    expect(blockStyleAt(h1)).toBe("heading1");

    const h2 = apply(h1, "heading2");
    expect(blockStyleAt(h2)).toBe("heading2");

    const text = apply(h2, "paragraph");
    expect(text.doc.firstChild?.type.name).toBe("paragraph");
    expect(text.doc.textContent).toBe("Kofer");
  });

  it("wraps text in a quote and leaves it again", () => {
    const quote = apply(stateWith([p("Rekla je da dolazi.")]), "quote");
    expect(quote.doc.firstChild?.type.name).toBe("blockquote");
    expect(blockStyleAt(quote)).toBe("quote");

    const text = apply(quote, "paragraph");
    expect(text.doc.firstChild?.type.name).toBe("paragraph");
    expect(text.doc.childCount).toBe(1);
  });

  it("makes a heading inside a quote leave the quote", () => {
    const quote = apply(stateWith([p("Naslov")]), "quote");
    const heading = apply(quote, "heading1");
    expect(heading.doc.firstChild?.type.name).toBe("heading");
    expect(blockStyleAt(heading)).toBe("heading1");
  });

  it("turns a heading into a quote as plain text", () => {
    const quote = apply(apply(stateWith([p("Kofer")]), "heading1"), "quote");
    expect(quote.doc.firstChild?.type.name).toBe("blockquote");
    expect(quote.doc.firstChild?.firstChild?.type.name).toBe("paragraph");
  });

  it("keeps the alignment", () => {
    const h1 = apply(stateWith([p("Kofer", { textAlign: "center" })]), "heading1");
    expect(h1.doc.firstChild?.attrs.textAlign).toBe("center");
  });

  it("does nothing inside a footnote", () => {
    const state = stateWith([
      p("Tekst"),
      { type: "footnotes", content: [{ type: "footnote", attrs: { id: "n1" }, content: [{ type: "text", text: "Beleška" }] }] },
    ], 10);
    expect(blockStyleAt(state)).toBeNull();
    expect(setBlockStyle("heading1")(state)).toBe(false);
  });
});

describe("old content", () => {
  it("reads paragraphs saved before alignment existed as left-aligned", () => {
    const state = stateWith([p("Stari tekst")]);
    expect(state.doc.firstChild?.attrs.textAlign).toBe("left");
    expect(state.doc.toJSON().content[0].attrs).toEqual({ textAlign: "left" });
  });
});

function key(init: Partial<KeyboardEvent> & { altGraph?: boolean }) {
  return {
    key: "",
    code: "",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...init,
    getModifierState: (name: string) => name === "AltGraph" && !!init.altGraph,
  };
}

describe("blockStyleShortcut", () => {
  it("maps Ctrl+Alt+0/1/2 to Tekst / Naslov 1 / Naslov 2", () => {
    expect(blockStyleShortcut(key({ ctrlKey: true, altKey: true, key: "0", code: "Digit0" }))).toBe("paragraph");
    expect(blockStyleShortcut(key({ ctrlKey: true, altKey: true, key: "1", code: "Digit1" }))).toBe("heading1");
    expect(blockStyleShortcut(key({ ctrlKey: true, altKey: true, key: "2", code: "Digit2" }))).toBe("heading2");
  });

  it("works with Cmd+Option on a Mac, where Option changes the key", () => {
    expect(blockStyleShortcut(key({ metaKey: true, altKey: true, key: "¡", code: "Digit1" }))).toBe("heading1");
  });

  it("lets AltGr characters through (Serbian AltGr+1 = ~)", () => {
    expect(blockStyleShortcut(key({ ctrlKey: true, altKey: true, key: "~", code: "Digit1" }))).toBeNull();
    expect(blockStyleShortcut(key({ ctrlKey: true, altKey: true, key: "Dead", code: "Digit2" }))).toBeNull();
    expect(
      blockStyleShortcut(key({ ctrlKey: true, altKey: true, key: "1", code: "Digit1", altGraph: true })),
    ).toBeNull();
  });

  it("ignores other combinations", () => {
    expect(blockStyleShortcut(key({ ctrlKey: true, key: "1", code: "Digit1" }))).toBeNull();
    expect(blockStyleShortcut(key({ ctrlKey: true, altKey: true, shiftKey: true, key: "1", code: "Digit1" }))).toBeNull();
    expect(blockStyleShortcut(key({ ctrlKey: true, altKey: true, key: "3", code: "Digit3" }))).toBeNull();
  });
});
