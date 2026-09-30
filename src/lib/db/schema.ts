import Dexie, { type EntityTable, type Table } from "dexie";
import type { JSONContent } from "@tiptap/react";
import { DEFAULT_LANGUAGE, type Language } from "@/lib/languages";
import { upgradeToParts } from "./migrations";

export type ID = string;

export interface Book {
  id: ID;
  title: string;
  /** Picks the AI prompt add-ons and typography (lib/languages). */
  language: Language;
  createdAt: number;
  updatedAt: number;
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

// Gaps between orders leave room to insert without renumbering.
export const ORDER_STEP = 1000;

export class MomentumDB extends Dexie {
  books!: EntityTable<Book, "id">;
  parts!: EntityTable<Part, "id">;
  dailyStats!: Table<DailyStat, [string, ID]>;
  resumeState!: EntityTable<ResumeState, "bookId">;

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
  }
}

export const db = new MomentumDB();
