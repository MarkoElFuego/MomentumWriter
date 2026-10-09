import Dexie, { type EntityTable, type Table } from "dexie";
import type { JSONContent } from "@tiptap/react";
import { DEFAULT_LANGUAGE, type Language } from "@/lib/languages";
import type { ThemeName } from "@/lib/themes";
import type { WHISPER_KINDS, WHISPER_MOMENTS } from "@/lib/ai/tiron";
import { upgradeTitleHeadings, upgradeToParts } from "./migrations";

export type ID = string;

/** Srce knjige (Tiron T1): the author's own answers, each optional. */
export interface BookHeart {
  about?: string;
  ending?: string;
  why?: string;
}

export const GENRES = [
  "misterija",
  "triler",
  "fantastika",
  "naučna fantastika",
  "ljubavni",
  "horor",
  "istorijski",
  "literarni",
  "za decu",
  "drugo",
] as const;
export type Genre = (typeof GENRES)[number];

/** Rough length choices: short novel / novel / long novel. Unset = "ne znam". */
export const TARGET_WORDS = [40_000, 80_000, 120_000] as const;

export interface Book {
  id: ID;
  title: string;
  /** Picks the AI prompt add-ons and typography (lib/languages). */
  language: Language;
  createdAt: number;
  updatedAt: number;
  /** Book language score (U7) and the value before the last change, for ↑3 / ↓2. */
  languageScore?: { value: number; previous?: number };
  heart?: BookHeart;
  targetWords?: number;
  genre?: Genre;
  /** The strongest sentence of each part, quoted exactly (T2) — Tiron uses them later, never shown. */
  bestLines?: BestLine[];
  /** Set while the deletion can still be undone; the book and all its records go after UNDO_DELETE_MS. */
  deletedAt?: number;
  /** „Označi kraj nacrta” (T7): from now on the book is no longer "Nacrt 1". */
  draftFinishedAt?: number;
  /** Export (ZADATAK_IZVOZ P4): the manuscript's title page and running head. */
  author?: string;
  /** E-mail, phone… one item per line. */
  contact?: string;
}

export interface BestLine {
  partId: ID;
  text: string;
  savedAt: number;
}

/** One line Tiron remembers (T2). The author's own (added or edited) are pinned — AI never touches them. */
export interface MemoryItem {
  id: ID;
  /** At most MEMORY_ITEM_CHARS (lib/ai/memory). */
  text: string;
  source: "ai" | "user";
  pinned: boolean;
}

export const MEMORY_LISTS = ["characters", "places", "openThreads"] as const;
export type MemoryList = (typeof MEMORY_LISTS)[number];

/** What Tiron remembers about one book. No separate promises: a promise of the story is an open thread. */
export interface StoryMemory extends Record<MemoryList, MemoryItem[]> {
  bookId: ID;
  updatedAt: number;
  /** The part whose text the last AI update read. */
  updatedAfterPartId?: ID;
}

/** Front matter, a numbered chapter, or back matter — each is one document. */
export type PartKind = "front" | "chapter" | "back";

export interface Part {
  id: ID;
  bookId: ID;
  kind: PartKind;
  /** Chapters are numbered automatically; the title is an optional name ("" = none). */
  title: string;
  /** Order within its kind; the kinds always come front → chapter → back. */
  order: number;
  content: JSONContent;
  wordCount: number;
  createdAt: number;
  updatedAt: number;
  /** Set while the deletion can still be undone; the part is gone for good after UNDO_DELETE_MS. */
  deletedAt?: number;
  /** Saved when the author leaves the part; never for the part being written. */
  languageScore?: PartLanguageScore;
  /** 2–3 sentences of what happens, like an editor's note (T2). */
  summary?: string;
  /** hashText of the text the summary was made from — unchanged text is never sent again. */
  summaryForHash?: string;
  /** Word count when Tiron last read this part — the 500-new-words threshold counts from here. */
  memoryWords?: number;
}

export interface PartLanguageScore {
  score: number;
  /** Open (neither accepted nor rejected) corrections when it was saved. */
  diacritics: number;
  grammar: number;
  /** Words of the paragraphs that were checked — the weight in the book score. */
  words: number;
}

/** A correction the author rejected: same paragraph text → same place, so it stays rejected. */
export interface RejectedEdit {
  from: string;
  to: string;
  /** Offset in the paragraph text. */
  start: number;
}

/** One paragraph's language check, kept until the paragraph changes (U7). */
export interface ProofCacheEntry {
  /** PROOF_CACHE_VERSION:language:hash(text) */
  key: string;
  /** Kept to rule out a hash collision. */
  text: string;
  /** The proofreader's paragraph; null = the server rejected it (don't ask again). */
  corrected: string | null;
  rejected: RejectedEdit[];
  createdAt: number;
  /** Every cache hit refreshes it; entries unused for 90 days are removed. */
  usedAt: number;
}

/** A stretch of writing (T4): saves less than SESSION_GAP_MS apart. Words are counted from save to save. */
export interface Session {
  id: ID;
  bookId: ID;
  /** Every part written in it, in the order they were first saved. */
  partIds: ID[];
  startedAt: number;
  /** The last save — moves forward with every save. */
  endedAt: number;
  wordsAdded: number;
  wordsDeleted: number;
  /** Local hour (0–23) the session started. */
  hour: number;
}

export type WhisperMoment = (typeof WHISPER_MOMENTS)[number];
export type WhisperKind = (typeof WHISPER_KINDS)[number];

/** What Tiron said on his own (T5) — never while the author types. */
export interface Whisper {
  id: ID;
  bookId: ID;
  moment: WhisperMoment;
  kind: WhisperKind;
  text: string;
  /** One of Book.bestLines, word for word, and the part it is from. */
  quote?: string;
  quotePartId?: ID;
  /** The session it closes (sessionEnd) or was said in — for "once per session" and "2 per session". */
  sessionId?: ID;
  createdAt: number;
  /** × took it off the top; it stays in the history. */
  dismissed: boolean;
  /** The author has opened the panel since it came — no dot on T. */
  seen: boolean;
  /** An entry whisper made ahead, at the end of the last session (T6): hidden until Resume shows it. */
  waiting?: boolean;
}

export interface DailyStat {
  date: string;
  bookId: ID;
  startWordTotal: number;
  endWordTotal: number;
}

export interface ResumeState {
  bookId: ID;
  partId: ID;
  cursorPos: number;
  lastSentence: string;
  lastWrittenAt: number;
  openQuestion?: string;
  openQuestionFor?: string;
  /** Mala pobeda (T6): what moved in the story last session and one question for today. */
  lastWin?: LastWin;
}

export interface LastWin {
  progress: string;
  tomorrow: string;
  sessionId: ID;
  createdAt: number;
}

/** How the writing screen looks — one record, key "appearance". */
export interface Appearance {
  key: "appearance";
  /** Unset = follow the system (dark → noc, otherwise papir). */
  theme?: ThemeName;
  /** Paragraphs other than the current one fade. */
  focusMode: boolean;
  /** The cursor line stays around the middle of the screen. */
  typewriter: boolean;
}

/** Right panel sections that collapse; the ones listed here are open — key "panels". */
export type PanelSection = "book" | "later";

export interface PanelSettings {
  key: "panels";
  open: PanelSection[];
}

export type Setting = Appearance | PanelSettings;

// Gaps between orders leave room to insert without renumbering.
export const ORDER_STEP = 1000;

export class MomentumDB extends Dexie {
  books!: EntityTable<Book, "id">;
  parts!: EntityTable<Part, "id">;
  dailyStats!: Table<DailyStat, [string, ID]>;
  resumeState!: EntityTable<ResumeState, "bookId">;
  settings!: EntityTable<Setting, "key">;
  proofCache!: EntityTable<ProofCacheEntry, "key">;
  storyMemory!: EntityTable<StoryMemory, "bookId">;
  sessions!: EntityTable<Session, "id">;
  whispers!: EntityTable<Whisper, "id">;

  constructor() {
    super("momentum");
    // Never edit an existing version — add db.version(n + 1) with .upgrade().
    this.version(1).stores({
      books: "id, updatedAt",
      chapters: "id, bookId, [bookId+order]",
      scenes: "id, chapterId, bookId, [chapterId+order], updatedAt",
      dailyStats: "[date+bookId], bookId",
      resumeState: "bookId",
    });
    // v2: Book.language. No index, so the stores stay as in v1.
    this.version(2)
      .stores({})
      .upgrade((tx) =>
        tx
          .table("books")
          .toCollection()
          .modify((book: Partial<Book>) => {
            book.language ??= DEFAULT_LANGUAGE;
          }),
      );
    // v3: each chapter's scenes merge into one Part; chapters/scenes are dropped
    // after the upgrade has copied them.
    this.version(3)
      .stores({ parts: "id, bookId", chapters: null, scenes: null })
      .upgrade(upgradeToParts);
    // v4: settings (visual theme, focus mode, typewriter scroll). New table only —
    // nothing to copy; an empty table means defaults.
    this.version(4).stores({ settings: "key" });
    // v5: the chapter title has its own field above the text — an identical
    // Naslov 1 at the top of the text is removed. No index changes.
    this.version(5).stores({}).upgrade(upgradeTitleHeadings);
    // v6: Part.deletedAt (soft delete with undo). Optional, unset on every
    // existing part — nothing to upgrade, no index (filtered in memory).
    this.version(6).stores({});
    // v7: proofCache (language check per paragraph, so reopening a chapter
    // costs no API calls) + optional Part/Book.languageScore. New table only.
    this.version(7).stores({ proofCache: "key, usedAt" });
    // v8: optional Book.heart / targetWords / genre (Tiron T1) and a "panels"
    // record in settings. No index, nothing to copy — unset means "not answered".
    this.version(8).stores({});
    // v9: storyMemory (Tiron T2) + optional Part.summary / summaryForHash /
    // memoryWords and Book.bestLines. New table only — nothing to copy.
    this.version(9).stores({ storyMemory: "bookId" });
    // v10: Book.deletedAt (soft delete with undo, like parts in v6). Optional,
    // unset on every existing book — nothing to upgrade, no index.
    this.version(10).stores({});
    // v11: sessions (Tiron T4) — how the author writes, never what. New table only.
    this.version(11).stores({ sessions: "id, bookId" });
    // v12: whispers (Tiron T5). New table only.
    this.version(12).stores({ whispers: "id, bookId" });
    // v13: optional ResumeState.lastWin and Whisper.waiting (T6). No index, nothing to copy.
    this.version(13).stores({});
    // v14: optional Book.draftFinishedAt (T7). No index, nothing to copy.
    this.version(14).stores({});
    // v15: optional Book.author and Book.contact (export, P4). No index, nothing to copy.
    this.version(15).stores({});
  }
}

export const db = new MomentumDB();
