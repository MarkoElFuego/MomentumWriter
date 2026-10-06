import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import { draftBookends, firstSentence, pageCount, pagesLeft, writingDays } from "./draftEnd";

describe("pagesLeft", () => {
  it("counts pages of 300 words left to the planned length, rounding up", () => {
    expect(pagesLeft(32_000, 40_000)).toBe(27); // 8000 / 300 = 26.7
    expect(pagesLeft(39_901, 40_000)).toBe(1);
    expect(pagesLeft(40_000, 40_000)).toBe(0);
    expect(pagesLeft(41_000, 40_000)).toBeLessThan(0);
  });

  it("reads as a short line, or that the length is reached", () => {
    expect(copy.book.draftCountdown(27)).toBe("Još oko 27 stranica do kraja nacrta");
    expect(copy.book.draftCountdown(1)).toBe("Još oko 1 stranica do kraja nacrta");
    expect(copy.book.draftCountdown(3)).toBe("Još oko 3 stranice do kraja nacrta");
    expect(copy.book.draftCountdown(0)).toBe("Planirana dužina je dostignuta.");
    expect(copy.book.draftCountdown(-4)).toBe("Planirana dužina je dostignuta.");
  });
});

describe("pageCount and writingDays", () => {
  it("rounds to pages, at least one once there is text", () => {
    expect(pageCount(0)).toBe(0);
    expect(pageCount(40)).toBe(1);
    expect(pageCount(80_400)).toBe(268);
  });

  it("counts only days the word total moved", () => {
    expect(
      writingDays([
        { startWordTotal: 0, endWordTotal: 500 },
        { startWordTotal: 500, endWordTotal: 500 }, // opened, nothing written
        { startWordTotal: 500, endWordTotal: 420 }, // cut — still a day of work
      ]),
    ).toBe(2);
  });

  it("reads days and pages with the right plural", () => {
    expect(copy.draftEnd.stats(42, 268)).toBe("42 dana pisanja · 268 stranica");
    expect(copy.draftEnd.stats(21, 1)).toBe("21 dan pisanja · 1 stranica");
    expect(copy.draftEnd.stats(3, 2)).toBe("3 dana pisanja · 2 stranice");
  });
});

describe("draftBookends", () => {
  it("first sentence of the first chapter, last sentence of the last — dedication and epilogue aside", () => {
    const parts = [
      { kind: "front" as const, text: "Mojoj baki." },
      { kind: "chapter" as const, text: "\n\nKiša je padala celu noć. Petar je čekao.\n\nMara je ćutala." },
      { kind: "chapter" as const, text: "" },
      { kind: "chapter" as const, text: "Kofer je bio prazan. Oboje su se nasmejali, prvi put posle mnogo godina, dugo i glasno, kao deca koja su znala da je kiša najzad prestala i da više nema čega da se boje." },
      { kind: "back" as const, text: "Hvala svima." },
    ];
    const { first, last } = draftBookends(parts);
    expect(first).toBe("Kiša je padala celu noć.");
    // Whole, even when long — no "…".
    expect(last.startsWith("Oboje su se nasmejali")).toBe(true);
    expect(last.endsWith("da se boje.")).toBe(true);
  });

  it("a book without chapters uses all its parts; an empty book has nothing", () => {
    expect(draftBookends([{ kind: "front", text: "Prvo. Drugo." }, { kind: "back", text: "Kraj priče." }])).toEqual({
      first: "Prvo.",
      last: "Kraj priče.",
    });
    expect(draftBookends([{ kind: "chapter", text: "   " }])).toEqual({ first: "", last: "" });
  });

  it("firstSentence skips empty paragraphs", () => {
    expect(firstSentence("\n\n   \n\n— Ko je tamo? — pitala je Mara.")).toBe("— Ko je tamo?");
  });
});
