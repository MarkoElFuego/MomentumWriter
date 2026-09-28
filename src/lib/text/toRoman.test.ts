import { describe, expect, it } from "vitest";
import { toRoman } from "./toRoman";

describe("toRoman", () => {
  it("converts common chapter numbers", () => {
    expect(toRoman(1)).toBe("I");
    expect(toRoman(4)).toBe("IV");
    expect(toRoman(7)).toBe("VII");
    expect(toRoman(14)).toBe("XIV");
    expect(toRoman(49)).toBe("XLIX");
  });

  it("falls back to digits for invalid input", () => {
    expect(toRoman(0)).toBe("0");
  });
});
