import { describe, expect, it } from "vitest";
import { endsMidSentence } from "./sentences";

describe("endsMidSentence", () => {
  it("is true when the last sentence is unfinished", () => {
    expect(endsMidSentence("Kisa je stala. Cesto mu je ponavljala da su to mali iznosi ali")).toBe(true);
    expect(endsMidSentence("Nije bio umoran, ali ")).toBe(true);
  });

  it("is false after sentence punctuation, with or without closing quotes", () => {
    expect(endsMidSentence("Petar je izasao.")).toBe(false);
    expect(endsMidSentence("Rekla je: „Idi.”")).toBe(false);
    expect(endsMidSentence("Zar opet?")).toBe(false);
  });

  it("looks only at the last non-empty paragraph", () => {
    expect(endsMidSentence("Petar je cekao i\n\nAna je dosla.\n\n")).toBe(false);
  });

  it("is false for empty text", () => {
    expect(endsMidSentence("")).toBe(false);
  });
});
