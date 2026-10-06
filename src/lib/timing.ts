// Pauses before the editor offers help. All in one place so the feel can be tuned.

/** Mid-sentence: short — the author is mid-thought and a completion should feel instant. */
export const GHOST_PAUSE_MID_MS = 1_500;

/** After a full stop: longer — a pause between sentences is usually thinking, not being stuck. */
export const GHOST_PAUSE_AFTER_MS = 3_000;

/** Language check of the paragraph being written, once the author stops typing. */
export const PROOFREAD_PAUSE_MS = 3_000;

/** Opening a book after a longer break shows the Resume screen first. */
export const RESUME_AFTER_MS = 6 * 60 * 60 * 1_000;

/** The toolbar fades once the author has been typing this long… */
export const TOOLBAR_FADE_AFTER_TYPING_MS = 1_500;

/** …where a longer gap between keys starts the count again. */
export const TOOLBAR_TYPING_GAP_MS = 2_000;

/** A deleted part can be brought back this long; after that it is gone for good. */
export const UNDO_DELETE_MS = 10_000;

/** Typewriter: a click centers its line after this long — sooner would move the text under a double click. */
export const TYPEWRITER_CLICK_DELAY_MS = 300;

/** Writing sessions (T4): a gap this long between saves starts a new session… */
export const SESSION_GAP_MS = 30 * 60 * 1_000;

/** …while the end of a session — the moment Tiron may speak (T5) — comes after this long without a save… */
export const SESSION_IDLE_END_MS = 20 * 60 * 1_000;

/** …or once the tab has been hidden this long. */
export const SESSION_HIDDEN_END_MS = 10 * 60 * 1_000;
