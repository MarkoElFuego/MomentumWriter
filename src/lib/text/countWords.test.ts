import { describe, expect, it } from "vitest";
import { countWords } from "./countWords";

describe("countWords", () => {
  it("returns 0 for empty or whitespace-only text", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n\t  ")).toBe(0);
  });

  it("counts Latin script with diacritics", () => {
    expect(countWords("Petar je zastao ispred vrata.")).toBe(5);
    expect(countWords("Đorđe, Šćepan i Žarko čekaju.")).toBe(5);
  });

  it("counts Cyrillic script", () => {
    expect(countWords("Петар је застао испред врата.")).toBe(5);
  });

  it("ignores standalone punctuation", () => {
    expect(countWords("Čekaj — nije to bilo … tako")).toBe(5);
    expect(countWords("„ Ne diraj to ” , rekao je.")).toBe(5);
  });

  it("handles multiple spaces and newlines", () => {
    expect(countWords("  jedan\n\ndva   tri\tčetiri  ")).toBe(4);
  });

  it("counts numbers and hyphenated words as single words", () => {
    expect(countWords("Bilo je 1999. godine, crno-bela slika.")).toBe(6);
  });
});
