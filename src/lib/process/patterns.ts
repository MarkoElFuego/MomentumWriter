import type { ProcessSignals } from "./signals";

// The process patterns Tiron may name on entry (T5) — at most one a day.

export const PATTERNS = ["longBreak", "perfectionism", "middleSlump", "nearEnd"] as const;
export type ProcessPattern = (typeof PATTERNS)[number];

/** Above this share of deleted words, together with restarts, the author keeps rewriting. */
export const REWRITE_RATIO_LIMIT = 0.5;
export const RESTARTS_LIMIT = 3;
export const LONG_BREAK_DAYS = 4;

/**
 * The one pattern worth a word today, most pressing first: a long break, then
 * rewriting the same part, then a slump in the middle, then the end in sight.
 */
export function pickPattern(signals: ProcessSignals): ProcessPattern | null {
  if (signals.daysSinceLastSession !== null && signals.daysSinceLastSession >= LONG_BREAK_DAYS) return "longBreak";
  if (signals.rewriteRatio > REWRITE_RATIO_LIMIT && signals.restartsOfCurrentPart >= RESTARTS_LIMIT) return "perfectionism";
  if (signals.bookPosition === "sredina" && signals.trend === "pad") return "middleSlump";
  if (signals.bookPosition === "kraj") return "nearEnd";
  return null;
}
