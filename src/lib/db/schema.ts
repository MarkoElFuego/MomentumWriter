import Dexie, { type EntityTable, type Table } from "dexie";
import type { JSONContent } from "@tiptap/react";
import { DEFAULT_LANGUAGE, type Language } from "@/lib/languages";
import type { ThemeName } from "@/lib/themes";
import { upgradeTitleHeadings, upgradeToParts } from "./migrations";

export type ID = string;

export interface Book {
  id: ID;
  title: string;
  /** Picks the AI prompt add-ons and typography (lib/languages). */
  language: Language;
  createdAt: number;
  updatedAt: number;
  /** Book language score (U7) and the value before the last change, for ↑3 / ↓2. */
  languageScore?: { value: number; previous?: number };
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

// Gaps between orders leave room to insert without renumbering.
export const ORDER_STEP = 1000;

export class MomentumDB extends Dexie {
  books!: EntityTable<Book, "id">;
  parts!: EntityTable<Part, "id">;
  dailyStats!: Table<DailyStat, [string, ID]>;
  resumeState!: EntityTable<ResumeState, "bookId">;
  settings!: EntityTable<Appearance, "key">;
  proofCache!: EntityTable<ProofCacheEntry, "key">;

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
  }
}

export const db = new MomentumDB();
