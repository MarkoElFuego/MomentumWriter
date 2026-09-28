import { describe, expect, it } from "vitest";
import { countWords } from "./countWords";
import { extractContext, type TextSource } from "./extractContext";

// Mimics ProseMirror's textBetween for a doc of paragraphs: positions are plain
// string offsets and blocks are joined with the given separator.
function fakeDoc(paragraphs: string[]): TextSource & { end: number } {
  const text = paragraphs.join("\n\n");
  return {
    end: text.length,
    textBetween: (from, to, separator = "") =>
      text.slice(from, to).replaceAll("\n\n", separator),
  };
}

const words = (n: number, word = "reč") => Array.from({ length: n }, () => word).join(" ");

describe("extractContext", () => {
  it("returns an empty string for an empty doc", () => {
    const doc = fakeDoc([""]);
    expect(extractContext(doc, doc.end)).toBe("");
  });

  it("returns short text whole and ignores text after the cursor", () => {
    const doc = fakeDoc(["Marko je ušao.", "Ana je ćutala. Onda je ustala."]);
    const pos = doc.end - " Onda je ustala.".length;
    expect(extractContext(doc, pos)).toBe("Marko je ušao.\n\nAna je ćutala.");
  });

  it("drops leading paragraphs that do not fit and keeps the last one whole", () => {
    const doc = fakeDoc([words(50, "staro"), words(8)]);
    expect(extractContext(doc, doc.end, 10)).toBe(words(8));
  });

  it("cuts a partly fitting paragraph at a sentence start", () => {
    const doc = fakeDoc(["Prva rečenica je duga i ne staje. Druga staje.", "Poslednji pasus."]);
    expect(extractContext(doc, doc.end, 5)).toBe("Druga staje.\n\nPoslednji pasus.");
  });

  it("treats closing quotes after punctuation as part of the sentence end", () => {
    const doc = fakeDoc(["Rekla je: „Idi.” Otišao je."]);
    expect(extractContext(doc, doc.end, 2)).toBe("Otišao je.");
  });

  it("cuts one endless sentence by words with a leading ellipsis", () => {
    const doc = fakeDoc([`${words(20, "dalje")} kraj`]);
    const context = extractContext(doc, doc.end, 5);
    expect(context).toBe(`…${words(4, "dalje")} kraj`);
    expect(countWords(context)).toBe(5);
  });

  it("does not count standalone dashes toward the budget", () => {
    const doc = fakeDoc(["Staro.", "Čekaj — nije — to"]);
    expect(extractContext(doc, doc.end, 3)).toBe("Čekaj — nije — to");
  });

  it("returns nothing when maxWords is 0", () => {
    const doc = fakeDoc(["Nešto."]);
    expect(extractContext(doc, doc.end, 0)).toBe("");
  });
});
