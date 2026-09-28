import { describe, expect, it } from "vitest";
import { canSuggest, nextWord } from "./ghost";

describe("canSuggest", () => {
  it("suggests at the end of an unfinished sentence", () => {
    expect(canSuggest("Govorila je da su to mali iznosi ali", "", true)).toBe(true);
  });

  it("does not suggest after a finished sentence", () => {
    expect(canSuggest("Petar je izasao.", "", true)).toBe(false);
  });

  it("does not suggest in the middle of a line", () => {
    expect(canSuggest("Petar je", " izasao.", true)).toBe(false);
  });

  it("ignores trailing whitespace after the cursor", () => {
    expect(canSuggest("Petar je", "  ", true)).toBe(true);
  });

  it("does not suggest over a selection or in empty text", () => {
    expect(canSuggest("Petar je", "", false)).toBe(false);
    expect(canSuggest("", "", true)).toBe(false);
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
