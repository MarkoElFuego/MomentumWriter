import { describe, expect, it } from "vitest";
import { auditWords, wordsOf } from "./wordAudit";

describe("auditWords", () => {
  it("same words in another layout pass", () => {
    expect(auditWords("Petar je\nzastao, ispred vrata.", "petar je zastao ispred\n\nvrata")).toEqual({ missing: [], added: [] });
  });

  it("a lost word is found, even a repeated one", () => {
    expect(auditWords("Kiša, kiša i kiša.", "Kiša i kiša.")).toEqual({ missing: ["kiša"], added: [] });
  });

  it("a changed word is missing and added", () => {
    expect(auditWords("Petar je došao.", "Petar je dosao.")).toEqual({ missing: ["došao"], added: ["dosao"] });
  });

  it("allowed removals (chapter numbers, footnote markers) don't count", () => {
    expect(auditWords("Poglavlje 3: Kofer\nTekst [1].", "Kofer\nTekst", ["Poglavlje 3: Kofer", "[1]"])).toEqual({ missing: [], added: [] });
  });

  it("a word joined at a line end is the same word", () => {
    expect(auditWords("rastav-\nljeno", "rastavljeno")).toEqual({ missing: [], added: [] });
  });

  it("dashes and punctuation are not words", () => {
    expect(wordsOf("— Gde si? … „Kofer” crno-beli")).toEqual(["gde", "si", "kofer", "crnobeli"]);
  });
});
