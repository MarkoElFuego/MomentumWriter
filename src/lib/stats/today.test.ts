import { describe, expect, it } from "vitest";
import { calendarDaysBetween, localDateKey, wordsDelta } from "./today";

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

describe("calendarDaysBetween", () => {
  const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime();

  it("counts calendar days, not 24-hour blocks", () => {
    expect(calendarDaysBetween(at(1, 8), at(1, 23))).toBe(0);
    expect(calendarDaysBetween(at(1, 23), at(2, 1))).toBe(1);
    expect(calendarDaysBetween(at(1, 1), at(6, 23))).toBe(5);
  });

  it("stays whole across a daylight saving change", () => {
    expect(calendarDaysBetween(new Date(2026, 9, 24, 12).getTime(), new Date(2026, 9, 26, 12).getTime())).toBe(2);
  });
});
