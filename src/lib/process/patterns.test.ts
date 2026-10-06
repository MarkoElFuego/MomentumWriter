import { describe, expect, it } from "vitest";
import { pickPattern } from "./patterns";
import type { ProcessSignals } from "./signals";

const calm: ProcessSignals = {
  daysSinceLastSession: 1,
  sessionsLast7Days: 4,
  rewriteRatio: 0.1,
  restartsOfCurrentPart: 0,
  bookPosition: "početak",
  typicalHour: 21,
  trend: "stabilno",
};

describe("pickPattern", () => {
  it("finds nothing worth a word in a calm week", () => {
    expect(pickPattern(calm)).toBeNull();
    expect(pickPattern({ ...calm, daysSinceLastSession: null, bookPosition: null, trend: null })).toBeNull();
  });

  it("a break of four days or more", () => {
    expect(pickPattern({ ...calm, daysSinceLastSession: 3 })).toBeNull();
    expect(pickPattern({ ...calm, daysSinceLastSession: 4 })).toBe("longBreak");
  });

  it("rewriting the same part: over half deleted and three restarts", () => {
    expect(pickPattern({ ...calm, rewriteRatio: 0.6, restartsOfCurrentPart: 3 })).toBe("perfectionism");
    expect(pickPattern({ ...calm, rewriteRatio: 0.5, restartsOfCurrentPart: 3 })).toBeNull();
    expect(pickPattern({ ...calm, rewriteRatio: 0.6, restartsOfCurrentPart: 2 })).toBeNull();
  });

  it("a slump in the middle, the end in sight", () => {
    expect(pickPattern({ ...calm, bookPosition: "sredina", trend: "pad" })).toBe("middleSlump");
    expect(pickPattern({ ...calm, bookPosition: "sredina" })).toBeNull();
    expect(pickPattern({ ...calm, bookPosition: "kraj" })).toBe("nearEnd");
  });

  it("the most pressing one wins", () => {
    const everything: ProcessSignals = {
      ...calm,
      daysSinceLastSession: 5,
      rewriteRatio: 0.7,
      restartsOfCurrentPart: 4,
      bookPosition: "kraj",
    };
    expect(pickPattern(everything)).toBe("longBreak");
    expect(pickPattern({ ...everything, daysSinceLastSession: 1 })).toBe("perfectionism");
    expect(pickPattern({ ...everything, daysSinceLastSession: 1, rewriteRatio: 0 })).toBe("nearEnd");
  });
});
