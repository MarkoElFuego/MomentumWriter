import { describe, expect, it } from "vitest";
import { localDateKey, wordsDelta } from "./today";

describe("localDateKey", () => {
  it("formats local date with zero padding", () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("wordsDelta", () => {
  it("never goes below zero when text was deleted", () => {
    expect(wordsDelta(100, 80)).toBe(0);
    expect(wordsDelta(100, 347)).toBe(247);
  });
});
