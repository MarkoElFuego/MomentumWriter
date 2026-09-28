import Dexie, { type EntityTable, type Table } from "dexie";
import type { JSONContent } from "@tiptap/react";

export type ID = string;

export interface Book {
  id: ID;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Chapter {
  id: ID;
  bookId: ID;
  title: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface Scene {
  id: ID;
  chapterId: ID;
  bookId: ID;
  title: string;
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
  sceneId: ID;
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
  chapters!: EntityTable<Chapter, "id">;
  scenes!: EntityTable<Scene, "id">;
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
  }
}

export const db = new MomentumDB();
