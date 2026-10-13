import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/react";
import { docFromJSON } from "@/components/editor/contentSchema";
import { textToBlocks } from "./fromText";
import { mergeWithPrevious, splitBook, titlePagePart, type SplitBook } from "./splitBook";
import { docText } from "./text";
import { auditWords, importedText } from "./wordAudit";

const words = (n: number, word = "reč") => Array.from({ length: n }, () => word).join(" ");

/** Every import test: valid editor documents and no lost words. */
function check(source: string, split: SplitBook) {
  for (const part of split.parts) docFromJSON(part.content, "sr-Latn").check();
  if (split.titlePage) docFromJSON(split.titlePage.content, "sr-Latn").check();
  expect(auditWords(source, importedText(split.parts, split.titlePage), split.dropped)).toEqual({ missing: [], added: [] });
}

const fromText = (text: string) => {
  const split = splitBook(textToBlocks(text));
  check(text, split);
  return split;
};

const summary = (split: SplitBook) => split.parts.map((part) => [part.kind, part.title]);
const body = (content: JSONContent) => (content.content ?? []).filter((block) => block.type !== "footnotes");

describe("splitBook — plain text", () => {
  it("chapters by a repeating pattern; the number goes, the name stays", () => {
    const split = fromText(
      ["Poglavlje 1: Vrata", "", "Petar je zastao.", "", "Poglavlje 2", "", "Kofer je bio težak.", "", "Poglavlje 3: Kraj", "", "Kiša."].join("\n"),
    );
    expect(split.recognized).toBe(true);
    expect(summary(split)).toEqual([
      ["chapter", "Vrata"],
      ["chapter", ""],
      ["chapter", "Kraj"],
    ]);
    expect(split.parts[0]).toMatchObject({ words: 3, firstSentence: "Petar je zastao." });
    expect(split.dropped).toEqual(["Poglavlje 1: Vrata", "Poglavlje 2", "Poglavlje 3: Kraj"]);
  });

  it("roman numerals with names", () => {
    const split = fromText("III · Kofer\nPetar je ćutao.\nIV – Grad\nGrad je spavao.");
    expect(summary(split)).toEqual([
      ["chapter", "Kofer"],
      ["chapter", "Grad"],
    ]);
  });

  it("a pattern that appears once is not a chapter", () => {
    const split = fromText("Poglavlje 1\nPetar je zastao.\nKiša je padala.");
    expect(split.recognized).toBe(false);
    expect(summary(split)).toEqual([["chapter", ""]]);
    expect(docText(split.parts[0]!.content)).toContain("Poglavlje 1");
  });

  it("false headings stay text: a sentence with a number, dialogue", () => {
    const split = fromText(
      ["1", "3 dana kasnije.", "— Treće?", "Petar je ćutao.", "2", "3 dana kasnije.", "Kraj."].join("\n"),
    );
    expect(summary(split)).toEqual([
      ["chapter", ""],
      ["chapter", ""],
    ]);
    expect(docText(split.parts[0]!.content)).toBe("3 dana kasnije.\n— Treće?\nPetar je ćutao.");
  });

  it("front matter before the first chapter, back matter after the last", () => {
    const split = fromText(
      ["Posveta", "Za Maru.", "Prolog", "Bilo je hladno.", "Poglavlje 1", "Tekst.", "Epilog", "U sredini.", "Poglavlje 2", "Tekst.", "Epilog", "Kraj.", "Zahvalnica", "Hvala."].join("\n"),
    );
    expect(summary(split)).toEqual([
      ["front", "Posveta"],
      ["front", "Prolog"],
      ["chapter", ""],
      ["chapter", ""],
      ["back", "Epilog"],
      ["back", "Zahvalnica"],
    ]);
    // "Epilog" in the middle of the book is text of chapter 1.
    expect(docText(split.parts[2]!.content)).toBe("Tekst.\nEpilog\nU sredini.");
  });

  it("a short text before the first part is a title page", () => {
    const split = fromText(["Kiša nad gradom", "Marko Marković", "1", "Tekst.", "2", "Tekst."].join("\n"));
    expect(split.titlePage).toMatchObject({ title: "Kiša nad gradom", words: 5 });
    expect(summary(split)).toEqual([
      ["chapter", ""],
      ["chapter", ""],
    ]);
    expect(titlePagePart(split.titlePage!)).toMatchObject({ kind: "front", title: "Naslovna", words: 5 });
  });

  it("a long text before the first part is an untitled front part", () => {
    const split = fromText([`${words(61)}.`, "1", "Tekst.", "2", "Tekst."].join("\n"));
    expect(split.titlePage).toBeUndefined();
    expect(summary(split)[0]).toEqual(["front", ""]);
    expect(split.parts[0]!.words).toBe(61);
  });

  it("„Deo prvi” becomes a heading at the start of the next chapter", () => {
    const split = fromText(["Deo prvi", "Poglavlje 1", "Tekst.", "Deo drugi: Grad", "Poglavlje 2", "Tekst."].join("\n"));
    expect(summary(split)).toEqual([
      ["chapter", ""],
      ["chapter", ""],
    ]);
    expect(body(split.parts[0]!.content)[0]).toEqual({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Deo prvi" }] });
    expect(body(split.parts[1]!.content)[0]).toMatchObject({ type: "heading", content: [{ text: "Deo drugi: Grad" }] });
  });

  it("a line of marks is a scene break", () => {
    for (const mark of ["***", "* * *", "#", "§", "~", "✱ ✱ ✱"]) {
      const split = fromText(`Prva scena.\n${mark}\nDruga scena.`);
      expect(body(split.parts[0]!.content).map((block) => block.type)).toEqual(["paragraph", "sceneBreak", "paragraph"]);
    }
  });

  it("lines split mid-sentence are joined like „Sredi tekst”", () => {
    const split = fromText("Petar je zastao\nispred vrata. Bila su rastav-\nljena.\n\nNov pasus.");
    expect(docText(split.parts[0]!.content)).toBe("Petar je zastao ispred vrata. Bila su rastavljena.\nNov pasus.");
  });

  it("nothing recognized → one chapter with the whole text", () => {
    const split = fromText("Petar je zastao.\n\nKiša je padala.");
    expect(split).toMatchObject({ recognized: false, dropped: [] });
    expect(split.parts).toHaveLength(1);
    expect(split.parts[0]).toMatchObject({ kind: "chapter", title: "", words: 6 });
  });

  it("empty text → one empty chapter", () => {
    const split = fromText("");
    expect(split.parts).toEqual([expect.objectContaining({ kind: "chapter", words: 0 })]);
  });
});

describe("splitBook — styled headings", () => {
  const h = (level: number, text: string): JSONContent => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
  const p = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });
  const source = (blocks: JSONContent[]) => blocks.map((block) => block.content?.[0]?.text ?? "").join("\n");

  it("splits by the highest heading level that repeats; lower headings stay in the text", () => {
    const blocks = [h(1, "Kiša"), p("Marko"), h(2, "Kofer"), p("Tekst."), h(3 - 1, "Grad"), p("Tekst.")];
    const split = splitBook(blocks);
    check(source(blocks), split);
    expect(split.titlePage?.title).toBe("Kiša");
    expect(summary(split)).toEqual([
      ["chapter", "Kofer"],
      ["chapter", "Grad"],
    ]);
  });

  it("styled names: number stripped, Prolog and Epilog in place, a subheading inside stays", () => {
    const blocks = [h(1, "Prolog"), p("A."), h(1, "Poglavlje 1: Vrata"), h(2, "Jutro"), p("B."), h(1, "Kofer"), p("C."), h(1, "Epilog"), p("D.")];
    const split = splitBook(blocks);
    check(source(blocks), split);
    expect(summary(split)).toEqual([
      ["front", "Prolog"],
      ["chapter", "Vrata"],
      ["chapter", "Kofer"],
      ["back", "Epilog"],
    ]);
    // The level right under the chapters is Naslov 1.
    expect(body(split.parts[1]!.content)[0]).toMatchObject({ type: "heading", attrs: { level: 1 } });
  });

  it("styled „Deo prvi” doesn't count as a chapter level", () => {
    const blocks = [h(1, "Deo prvi"), h(2, "Vrata"), p("A."), h(2, "Kofer"), p("B."), h(1, "Deo drugi"), h(2, "Grad"), p("C.")];
    const split = splitBook(blocks);
    check(source(blocks), split);
    expect(summary(split).map(([, title]) => title)).toEqual(["Vrata", "Kofer", "Grad"]);
    expect(body(split.parts[2]!.content)[0]).toMatchObject({ type: "heading", content: [{ text: "Deo drugi" }] });
  });
});

describe("splitBook — footnotes", () => {
  const ref = (id: string): JSONContent => ({ type: "footnoteRef", attrs: { id } });
  const notes = new Map<string, JSONContent[]>([
    ["a", [{ type: "text", text: "Prva beleška." }]],
    ["b", [{ type: "text", text: "Druga, " }, { type: "text", text: "u kurzivu", marks: [{ type: "italic" }] }]],
  ]);
  const blocks: JSONContent[] = [
    { type: "paragraph", content: [{ type: "text", text: "Poglavlje 1" }] },
    { type: "paragraph", content: [{ type: "text", text: "Usred" }, ref("a"), { type: "text", text: " rečenice." }] },
    { type: "paragraph", content: [{ type: "text", text: "Poglavlje 2" }] },
    { type: "paragraph", content: [{ type: "text", text: "Kraj." }, ref("b")] },
  ];

  it("each note goes into the zone of its own part", () => {
    const split = splitBook(blocks, notes);
    for (const part of split.parts) docFromJSON(part.content, "sr-Latn").check();
    expect(split.parts[0]!.content.content?.at(-1)).toEqual({
      type: "footnotes",
      content: [{ type: "footnote", attrs: { id: "a" }, content: notes.get("a") }],
    });
    expect(split.parts[1]!.content.content?.at(-1)?.content?.[0]?.attrs?.id).toBe("b");
    // Footnote words count, like in the editor.
    expect(split.parts[0]!.words).toBe(4);
    expect(split.parts[0]!.firstSentence).toBe("Usred rečenice.");
  });

  it("merging keeps both parts' notes and puts the heading back as text", () => {
    const split = splitBook(blocks, notes);
    const [merged] = mergeWithPrevious(split.parts, 1);
    docFromJSON(merged!.content, "sr-Latn").check();
    expect(merged!.content.content?.at(-1)?.content?.map((note) => note.attrs?.id)).toEqual(["a", "b"]);
    expect(docText(merged!.content)).toContain("Poglavlje 2\nKraj.");
  });
});

describe("mergeWithPrevious", () => {
  it("joins a wrong split back; words come back with the heading", () => {
    const text = ["1", "Tekst prvi.", "2", "Tekst drugi.", "3", "Tekst treći."].join("\n");
    const split = fromText(text);
    const merged = mergeWithPrevious(split.parts, 2);
    expect(merged).toHaveLength(2);
    expect(merged[1]).toMatchObject({ kind: "chapter", words: 5 });
    expect(docText(merged[1]!.content)).toBe("Tekst drugi.\n3\nTekst treći.");
    expect(auditWords(text, importedText(merged), split.dropped)).toEqual({ missing: [], added: [] });
  });

  it("does nothing for the first part", () => {
    const split = fromText("1\nA.\n2\nB.");
    expect(mergeWithPrevious(split.parts, 0)).toBe(split.parts);
  });
});
