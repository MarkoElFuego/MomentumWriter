import type { ID, Session } from "@/lib/db/schema";
import { SESSION_HIDDEN_END_MS, SESSION_IDLE_END_MS } from "@/lib/timing";

// Process signals (Tiron T4): how the author writes, computed locally from the
// sessions — never the text, never sent anywhere. Tiron's whispers (T5) read them.

const DAY_MS = 24 * 60 * 60 * 1_000;
/** A session on the open part that moved it less than this counts as starting over. */
export const RESTART_MAX_NET_WORDS = 150;
/** Enough history for a trend: three recent sessions and three to compare them with. */
export const TREND_MIN_SESSIONS = 6;

export type BookPosition = "početak" | "sredina" | "kraj";
export type Trend = "pad" | "stabilno";

export interface ProcessSignals {
  daysSinceLastSession: number | null;
  sessionsLast7Days: number;
  rewriteRatio: number;
  restartsOfCurrentPart: number;
  /** null while the length is "Ne znam". */
  bookPosition: BookPosition | null;
  typicalHour: number | null;
  /** null until there are TREND_MIN_SESSIONS sessions. */
  trend: Trend | null;
}

function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Calendar days since the last session ended (yesterday = 1), local time. */
export function daysSinceLastSession(sessions: Session[], now: number): number | null {
  const last = sessions.at(-1);
  if (!last) return null;
  // Rounded: a daylight-saving day is 23 or 25 hours long.
  return Math.round((startOfDay(now) - startOfDay(last.endedAt)) / DAY_MS);
}

export function sessionsLast7Days(sessions: Session[], now: number): number {
  return sessions.filter((session) => now - session.endedAt < 7 * DAY_MS).length;
}

/** Deleted / (added + deleted) over the last three sessions; 0 without any words. */
export function rewriteRatio(sessions: Session[]): number {
  const recent = sessions.slice(-3);
  const added = recent.reduce((sum, session) => sum + session.wordsAdded, 0);
  const deleted = recent.reduce((sum, session) => sum + session.wordsDeleted, 0);
  return added + deleted === 0 ? 0 : deleted / (added + deleted);
}

/** Sessions on this part that barely moved the book forward. */
export function restartsOfCurrentPart(sessions: Session[], partId: ID): number {
  return sessions.filter(
    (session) => session.partIds.includes(partId) && session.wordsAdded - session.wordsDeleted < RESTART_MAX_NET_WORDS,
  ).length;
}

export function bookPosition(totalWords: number, targetWords: number | undefined): BookPosition | null {
  if (!targetWords) return null;
  const share = totalWords / targetWords;
  if (share < 0.25) return "početak";
  if (share <= 0.8) return "sredina";
  return "kraj";
}

/** The hour sessions most often start at; a tie goes to the earlier hour. */
export function typicalHour(sessions: Session[]): number | null {
  const counts = new Map<number, number>();
  for (const session of sessions) counts.set(session.hour, (counts.get(session.hour) ?? 0) + 1);
  let best: number | null = null;
  for (const [hour, count] of counts) {
    const bestCount = best === null ? 0 : counts.get(best)!;
    if (count > bestCount || (count === bestCount && best !== null && hour < best)) best = hour;
  }
  return best;
}

/** "pad" when each of the last three sessions is under half the average length of the ones before. */
export function trend(sessions: Session[]): Trend | null {
  if (sessions.length < TREND_MIN_SESSIONS) return null;
  const length = (session: Session) => session.endedAt - session.startedAt;
  const before = sessions.slice(0, -3);
  const average = before.reduce((sum, session) => sum + length(session), 0) / before.length;
  if (average === 0) return "stabilno";
  return sessions.slice(-3).every((session) => length(session) < average * 0.5) ? "pad" : "stabilno";
}

export interface SignalInput {
  /** Oldest first. */
  sessions: Session[];
  partId: ID;
  totalWords: number;
  targetWords: number | undefined;
  now: number;
}

export function computeSignals({ sessions, partId, totalWords, targetWords, now }: SignalInput): ProcessSignals {
  return {
    daysSinceLastSession: daysSinceLastSession(sessions, now),
    sessionsLast7Days: sessionsLast7Days(sessions, now),
    rewriteRatio: rewriteRatio(sessions),
    restartsOfCurrentPart: restartsOfCurrentPart(sessions, partId),
    bookPosition: bookPosition(totalWords, targetWords),
    typicalHour: typicalHour(sessions),
    trend: trend(sessions),
  };
}

/**
 * The end of a session — the moment for Tiron's end-of-session whisper (T5):
 * no save for SESSION_IDLE_END_MS, or the tab hidden for SESSION_HIDDEN_END_MS.
 * Closing the page ends it too; the caller knows when that happens.
 */
export function isSessionOver(lastActivity: number, now: number, hiddenSince?: number): boolean {
  if (now - lastActivity >= SESSION_IDLE_END_MS) return true;
  return hiddenSince !== undefined && now - hiddenSince >= SESSION_HIDDEN_END_MS;
}
