import { describe, expect, it } from "vitest";
import { cursorSituation, nextWord, slashOpensMenu } from "./ghost";

describe("cursorSituation", () => {
  it("is mid inside an unfinished sentence", () => {
    expect(cursorSituation("Govorila je da su to mali iznosi ali", "", true)).toBe("mid");
    expect(cursorSituation("Nije bio umoran, ali ", "", true)).toBe("mid");
  });

  it("is after a finished sentence, including closing quotes", () => {
    expect(cursorSituation("Platio je domen.", "", true)).toBe("after");
    expect(cursorSituation("Zar opet?", "", true)).toBe("after");
    expect(cursorSituation("I onda…", "", true)).toBe("after");
    expect(cursorSituation("Rekla je: „Idi.”", "", true)).toBe("after");
    expect(cursorSituation("Rekla je: „Idi”", "", true)).toBe("after");
    expect(cursorSituation("Platio je domen. ", "", true)).toBe("after");
  });

  it("is empty in an empty paragraph", () => {
    expect(cursorSituation("", "", true)).toBe("empty");
    expect(cursorSituation("   ", "", true)).toBe("empty");
  });

  it("is none with a selection or with text after the cursor", () => {
    expect(cursorSituation("Petar je", "", false)).toBe("none");
    expect(cursorSituation("Petar je", " izasao.", true)).toBe("none");
    expect(cursorSituation("", "Nesto", true)).toBe("none");
  });

  it("ignores trailing whitespace after the cursor", () => {
    expect(cursorSituation("Petar je", "  ", true)).toBe("mid");
  });

  it("judges only the current paragraph", () => {
    // Called with the block's own text: a fresh paragraph without a period is mid.
    expect(cursorSituation("Sledeceg jutra", "", true)).toBe("mid");
  });
});

describe("slashOpensMenu", () => {
  it("opens at the start of an empty paragraph or after a space", () => {
    expect(slashOpensMenu("")).toBe(true);
    expect(slashOpensMenu("Platio je domen. ")).toBe(true);
  });

  it("types a normal slash inside a word or number", () => {
    expect(slashOpensMenu("i")).toBe(false);
    expect(slashOpensMenu("1")).toBe(false);
    expect(slashOpensMenu("Platio je domen.")).toBe(false);
  });
});

describe("nextWord", () => {
  it("takes the leading space and one word", () => {
    expect(nextWord(" nakupi se do velikog iznosa.")).toBe(" nakupi");
  });

  it("keeps punctuation attached to the word", () => {
    expect(nextWord(" iznosa. ")).toBe(" iznosa.");
  });

  it("returns an empty string when nothing is left", () => {
    expect(nextWord("   ")).toBe("");
  });
});
