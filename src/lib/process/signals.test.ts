import { describe, expect, it } from "vitest";
import type { Session } from "@/lib/db/schema";
import { SESSION_HIDDEN_END_MS, SESSION_IDLE_END_MS } from "@/lib/timing";
import {
  bookPosition,
  computeSignals,
  daysSinceLastSession,
  isSessionOver,
  restartsOfCurrentPart,
  rewriteRatio,
  sessionsLast7Days,
  trend,
  typicalHour,
} from "./signals";

const HOUR = 60 * 60 * 1_000;
const DAY = 24 * HOUR;
// Noon, local time — far from midnight so calendar days are unambiguous.
const NOW = new Date(2026, 9, 6, 12, 0, 0).getTime();

let next = 0;
function session(change: Partial<Session> = {}): Session {
  const startedAt = change.startedAt ?? NOW - DAY;
  return {
    id: `s${next++}`,
    bookId: "b1",
    partIds: ["p1"],
    startedAt,
    endedAt: startedAt + HOUR,
    wordsAdded: 500,
    wordsDeleted: 0,
    hour: new Date(startedAt).getHours(),
    ...change,
  };
}

describe("daysSinceLastSession", () => {
  it("counts calendar days, not 24-hour periods", () => {
    expect(daysSinceLastSession([], NOW)).toBeNull();
    expect(daysSinceLastSession([session({ startedAt: NOW - 2 * HOUR })], NOW)).toBe(0);
    // Late last night is yesterday, even though it was only a few hours ago.
    const lateYesterday = new Date(2026, 9, 5, 23, 0).getTime();
    expect(daysSinceLastSession([session({ startedAt: lateYesterday - HOUR, endedAt: lateYesterday })], NOW)).toBe(1);
    expect(daysSinceLastSession([session({ startedAt: NOW - 4 * DAY })], NOW)).toBe(4);
  });
});

describe("sessionsLast7Days", () => {
  it("counts sessions that ended in the last seven days", () => {
    const sessions = [session({ startedAt: NOW - 9 * DAY }), session({ startedAt: NOW - 6 * DAY }), session({ startedAt: NOW - HOUR * 2 })];
    expect(sessionsLast7Days(sessions, NOW)).toBe(2);
    expect(sessionsLast7Days([], NOW)).toBe(0);
  });
});

describe("rewriteRatio", () => {
  it("is deleted / (added + deleted) over the last three sessions", () => {
    const sessions = [
      session({ wordsAdded: 1000, wordsDeleted: 0 }), // older than the last three — not counted
      session({ wordsAdded: 100, wordsDeleted: 100 }),
      session({ wordsAdded: 100, wordsDeleted: 300 }),
      session({ wordsAdded: 0, wordsDeleted: 0 }),
    ];
    expect(rewriteRatio(sessions)).toBeCloseTo(400 / 600);
  });

  it("is 0 without any words", () => {
    expect(rewriteRatio([])).toBe(0);
    expect(rewriteRatio([session({ wordsAdded: 0, wordsDeleted: 0 })])).toBe(0);
  });
});

describe("restartsOfCurrentPart", () => {
  it("counts sessions on this part with a net gain under 150 words", () => {
    const sessions = [
      session({ partIds: ["p1"], wordsAdded: 300, wordsDeleted: 200 }), // +100 → restart
      session({ partIds: ["p1", "p2"], wordsAdded: 149, wordsDeleted: 0 }), // +149 → restart
      session({ partIds: ["p1"], wordsAdded: 150, wordsDeleted: 0 }), // +150 → progress
      session({ partIds: ["p2"], wordsAdded: 0, wordsDeleted: 50 }), // another part
    ];
    expect(restartsOfCurrentPart(sessions, "p1")).toBe(2);
    expect(restartsOfCurrentPart(sessions, "p3")).toBe(0);
  });
});

describe("bookPosition", () => {
  it("is beginning under 25%, middle up to 80%, end above", () => {
    expect(bookPosition(19_999, 80_000)).toBe("početak");
    expect(bookPosition(20_000, 80_000)).toBe("sredina");
    expect(bookPosition(64_000, 80_000)).toBe("sredina");
    expect(bookPosition(64_001, 80_000)).toBe("kraj");
    expect(bookPosition(100_000, 80_000)).toBe("kraj");
  });

  it("is unknown without a target length", () => {
    expect(bookPosition(5_000, undefined)).toBeNull();
  });
});

describe("typicalHour", () => {
  it("is the most common starting hour; a tie goes to the earlier one", () => {
    expect(typicalHour([])).toBeNull();
    expect(typicalHour([session({ hour: 21 }), session({ hour: 7 }), session({ hour: 21 })])).toBe(21);
    expect(typicalHour([session({ hour: 21 }), session({ hour: 7 })])).toBe(7);
  });
});

describe("trend", () => {
  const ofLength = (minutes: number) => session({ startedAt: NOW - DAY, endedAt: NOW - DAY + minutes * 60_000 });

  it("needs six sessions", () => {
    expect(trend([60, 60, 60, 10, 10].map(ofLength))).toBeNull();
  });

  it("is a decline when each of the last three is under half the earlier average", () => {
    expect(trend([60, 60, 60, 29, 20, 10].map(ofLength))).toBe("pad");
  });

  it("is steady when even one of the last three is long enough", () => {
    expect(trend([60, 60, 60, 29, 30, 10].map(ofLength))).toBe("stabilno");
    expect(trend([0, 0, 0, 0, 0, 0].map(ofLength))).toBe("stabilno");
  });
});

describe("computeSignals", () => {
  it("puts every signal in one object", () => {
    const sessions = [session({ startedAt: NOW - 2 * DAY, hour: 9, wordsAdded: 400, wordsDeleted: 100 })];
    expect(computeSignals({ sessions, partId: "p1", totalWords: 30_000, targetWords: 80_000, now: NOW })).toEqual({
      daysSinceLastSession: 2,
      sessionsLast7Days: 1,
      rewriteRatio: 0.2,
      restartsOfCurrentPart: 0,
      bookPosition: "sredina",
      typicalHour: 9,
      trend: null,
    });
  });

  it("works for a book nobody has written in yet", () => {
    expect(computeSignals({ sessions: [], partId: "p1", totalWords: 0, targetWords: undefined, now: NOW })).toEqual({
      daysSinceLastSession: null,
      sessionsLast7Days: 0,
      rewriteRatio: 0,
      restartsOfCurrentPart: 0,
      bookPosition: null,
      typicalHour: null,
      trend: null,
    });
  });
});

describe("isSessionOver", () => {
  it("after 20 minutes without a save, or 10 minutes with the tab hidden", () => {
    expect(isSessionOver(NOW, NOW + SESSION_IDLE_END_MS - 1)).toBe(false);
    expect(isSessionOver(NOW, NOW + SESSION_IDLE_END_MS)).toBe(true);
    expect(isSessionOver(NOW, NOW + 5 * 60_000, NOW + 60_000)).toBe(false);
    expect(isSessionOver(NOW, NOW + 60_000 + SESSION_HIDDEN_END_MS, NOW + 60_000)).toBe(true);
  });
});
