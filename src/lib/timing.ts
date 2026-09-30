// Pauses before the editor offers help. All in one place so the feel can be tuned.

/** Mid-sentence: short — the author is mid-thought and a completion should feel instant. */
export const GHOST_PAUSE_MID_MS = 1_500;

/** After a full stop: longer — a pause between sentences is usually thinking, not being stuck. */
export const GHOST_PAUSE_AFTER_MS = 3_000;

/** Empty paragraph: only a quiet hint, and only after a real stall. No AI call is made. */
export const STUCK_HINT_MS = 6_000;

/** Language check of the paragraph being written, once the author stops typing. */
export const PROOFREAD_PAUSE_MS = 3_000;
