"use client";

import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { chapterNumber, listParts, partLabel } from "@/lib/db/parts";
import { getResumeState } from "@/lib/db/resume";
import type { ID, LastWin } from "@/lib/db/schema";
import { listWhispers } from "@/lib/db/whispers";
import type { ShownWhisper } from "./useWhispers";

/** A greeting this fresh belongs to this visit to Resume. */
const ENTRY_FRESH_MS = 60 * 60 * 1_000;

export interface ResumeTiron {
  lastWin: LastWin | null;
  /** The entry (or pattern) whisper for this visit — delivered from waiting, or made now. */
  entry: ShownWhisper | null;
}

/**
 * Tiron on the Resume screen (T6), live from Dexie: what was ready shows at
 * once, and a small win or greeting that arrives while the screen is open
 * shows up when it comes — nothing waits for it.
 */
export function useResumeTiron(bookId: ID | null): ResumeTiron {
  const [state, setState] = useState<ResumeTiron>({ lastWin: null, entry: null });

  useEffect(() => {
    if (!bookId) return;
    const subscription = liveQuery(async () => {
      const [resume, whispers, parts] = await Promise.all([getResumeState(bookId), listWhispers(bookId), listParts(bookId)]);
      return { resume, whispers, parts };
    }).subscribe({
      next: ({ resume, whispers, parts }) => {
        const now = Date.now();
        const entry = whispers.find(
          (w) => !w.waiting && (w.moment === "entry" || w.moment === "pattern") && now - w.createdAt < ENTRY_FRESH_MS,
        );
        const part = entry?.quotePartId ? parts.find((p) => p.id === entry.quotePartId) : undefined;
        setState({
          lastWin: resume?.lastWin ?? null,
          entry: entry ? (part ? { ...entry, quoteLabel: partLabel(part, chapterNumber(parts, part.id)) } : entry) : null,
        });
      },
      error: (error) => console.error("Failed to read Tiron for Resume", error),
    });
    return () => subscription.unsubscribe();
  }, [bookId]);

  return state;
}
