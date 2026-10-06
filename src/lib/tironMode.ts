import type { WhisperMoment } from "@/lib/db/schema";

// „Tiron: prisutan / tih / isključen” in ···. A per-browser preference like
// Dopune — not manuscript content, so localStorage. Only the whispers: memory
// (T2) and „Zapeo sam” work in every mode (author's decision 2026-10-06).

export const TIRON_MODES = ["present", "quiet", "off"] as const;
export type TironMode = (typeof TIRON_MODES)[number];

const KEY = "momentum:tiron";

export function readTironMode(): TironMode {
  try {
    const stored = localStorage.getItem(KEY);
    return (TIRON_MODES as readonly string[]).includes(stored ?? "") ? (stored as TironMode) : "present";
  } catch {
    return "present";
  }
}

export function writeTironMode(mode: TironMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // UI preference only — safe to ignore.
  }
}

/** Quiet: only entering the book and the end of a session. Off: nothing, not even a request. */
export function momentAllowed(mode: TironMode, moment: WhisperMoment): boolean {
  if (mode === "off") return false;
  if (mode === "quiet") return moment !== "chapterEnd";
  return true;
}
