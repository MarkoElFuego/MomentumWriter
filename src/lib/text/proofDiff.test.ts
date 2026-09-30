import { describe, expect, it } from "vitest";
import { proofDiff, stripDiacritics, wordCountClose } from "./proofDiff";

describe("proofDiff", () => {
  it("returns nothing for an unchanged paragraph", () => {
    const text = "Jutro je bilo hladno i sivo.";
    expect(proofDiff(text, text)).toEqual([]);
  });

  it("marks diacritic-only changes with offsets into the original", () => {
    const original = "Cekao sam je ispred skole.";
    const edits = proofDiff(original, "Čekao sam je ispred škole.");
    expect(edits).toEqual([
      { from: "Cekao", to: "Čekao", start: 0, end: 5, type: "diacritic" },
      { from: "skole.", to: "škole.", start: 20, end: 26, type: "diacritic" },
    ]);
    for (const edit of edits) expect(original.slice(edit.start, edit.end)).toBe(edit.from);
  });

  it("treats dj → đ as a diacritic, even several in one word", () => {
    expect(proofDiff("Djordje je dosao.", "Đorđe je došao.")).toEqual([
      { from: "Djordje", to: "Đorđe", start: 0, end: 7, type: "diacritic" },
      { from: "dosao.", to: "došao.", start: 11, end: 17, type: "diacritic" },
    ]);
  });

  it("marks case endings and punctuation as grammar", () => {
    const edits = proofDiff("Pričao je o tvoj problem ali nije hteo.", "Pričao je o tvom problemu, ali nije hteo.");
    expect(edits.map(({ from, to, type }) => [from, to, type])).toEqual([
      ["tvoj", "tvom", "grammar"],
      ["problem", "problemu,", "grammar"],
    ]);
  });

  it("a diacritic plus a comma is grammar", () => {
    expect(proofDiff("Rekao sam da dodje ali nije.", "Rekao sam da dođe, ali nije.")[0]).toMatchObject({
      from: "dodje",
      to: "dođe,",
      type: "grammar",
    });
  });

  it("drops a word swapped for a different one", () => {
    expect(proofDiff("Bio je veoma umoran od puta.", "Bio je strašno umoran od puta.")).toEqual([]);
  });

  it("drops changes over 40% of a short word", () => {
    expect(proofDiff("Otišao je sa njim.", "Otišao je s njim.")).toEqual([]);
  });

  it("keeps later offsets right when the model adds or drops a word", () => {
    const original = "Nisam znao da ces doci tako rano ove godine.";
    const edits = proofDiff(original, "Nisam znao da ćeš doći rano ove godine.");
    expect(edits.map((e) => e.to)).toEqual(["ćeš", "doći"]);
    for (const edit of edits) expect(original.slice(edit.start, edit.end)).toBe(edit.from);
  });

  it("rejects the whole reply when the word count drifts over 20%", () => {
    expect(proofDiff("Jedan dva tri četiri pet.", "Jedan dva tri četiri pet šest sedam.")).toEqual([]);
  });
});

describe("wordCountClose", () => {
  it("allows up to 20% more or fewer words", () => {
    expect(wordCountClose("a b c d e", "a b c d e f")).toBe(true);
    expect(wordCountClose("a b c d e", "a b c")).toBe(false);
  });
});

describe("stripDiacritics", () => {
  it("maps đ to dj and keeps case", () => {
    expect(stripDiacritics("Đorđe čeka šoljU")).toBe("Djordje ceka soljU");
  });
});
