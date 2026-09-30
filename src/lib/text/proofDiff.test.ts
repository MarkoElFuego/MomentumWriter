import { describe, expect, it } from "vitest";
import { isProofreadOf, proofDiff, stripDiacritics, type DroppedChange } from "./proofDiff";

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

  it("offers a swap of short function words as grammar", () => {
    expect(proofDiff("Prognoze su bili je dobre.", "Prognoze su bili su dobre.")).toMatchObject([
      { from: "je", to: "su", type: "grammar" },
    ]);
  });

  it("joins a split and a missing space into one correction", () => {
    const original = "San mu je otežavao kapkeDosao je kući.";
    const edits = proofDiff(original, "San mu je otežavao kapke. Došao je kući.");
    expect(edits).toMatchObject([{ from: "kapkeDosao", to: "kapke. Došao", type: "grammar" }]);
    expect(original.slice(edits[0]!.start, edits[0]!.end)).toBe("kapkeDosao");
  });

  it("an added short word joins the word next to it", () => {
    const original = "Istraživanje je bilo povoljno njega.";
    const edits = proofDiff(original, "Istraživanje je bilo povoljno za njega.");
    expect(edits).toMatchObject([{ from: "njega.", to: "za njega." }]);
    expect(original.slice(edits[0]!.start, edits[0]!.end)).toBe("njega.");
  });

  it("each correction stays separate when words change and one is added", () => {
    const edits = proofDiff("Bili je povoljno njega.", "Bili su povoljni za njega.");
    expect(edits.map(({ from, to }) => [from, to])).toEqual([
      ["je", "su"],
      ["povoljno", "povoljni"],
      ["njega.", "za njega."],
    ]);
  });

  it("keeps later offsets right when the model adds or drops a word", () => {
    const original = "Nisam znao da ces doci tako rano ove godine.";
    const edits = proofDiff(original, "Nisam znao da ćeš doći rano ove godine.");
    expect(edits.map((e) => [e.from, e.to])).toEqual([
      ["ces", "ćeš"],
      ["doci", "doći"],
      ["tako rano", "rano"],
    ]);
    for (const edit of edits) expect(original.slice(edit.start, edit.end)).toBe(edit.from);
  });

  it("still offers fixes when the model drops a duplicated sentence", () => {
    const original = "Dosao je kuci i seo. Dosao je kuci i seo.";
    const edits = proofDiff(original, "Došao je kući i seo.");
    expect(edits.map((e) => e.to)).toEqual(["Došao", "kući"]);
    for (const edit of edits) expect(original.slice(edit.start, edit.end)).toBe(edit.from);
  });

  it("does not offer dropping a whole sentence, and says why", () => {
    const dropped: DroppedChange[] = [];
    const original = "Dosao je kuci. Onda je dugo sedeo sam u mraku.";
    expect(proofDiff(original, "Došao je kući.", dropped).map((e) => e.to)).toEqual(["Došao", "kući."]);
    expect(dropped).toMatchObject([{ reason: "too-big" }]);
  });

  it("rejects the whole reply when the paragraph was retold", () => {
    expect(proofDiff("Cekao sam je ispred skole.", "Stajao je satima pred zgradom i nadao se da će doći.")).toEqual([]);
  });
});

describe("isProofreadOf", () => {
  it("counts words without diacritics, case or punctuation", () => {
    expect(isProofreadOf("Cekao sam je ispred skole", "Čekao sam je ispred škole.")).toBe(true);
  });

  it("passes a reply made only of the author's words", () => {
    expect(isProofreadOf("a b c d e f g h", "a b c d")).toBe(true);
  });

  it("fails a reply with mostly new words", () => {
    expect(isProofreadOf("a b c d", "a x y z w")).toBe(false);
    expect(isProofreadOf("a b c", "")).toBe(false);
  });
});

describe("stripDiacritics", () => {
  it("maps đ to dj and keeps case", () => {
    expect(stripDiacritics("Đorđe čeka šoljU")).toBe("Djordje ceka soljU");
  });
});
