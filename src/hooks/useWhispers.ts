"use client";

import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { chapterNumber, listParts, partLabel } from "@/lib/db/parts";
import type { ID, Whisper } from "@/lib/db/schema";
import { listWhispers } from "@/lib/db/whispers";

export interface ShownWhisper extends Whisper {
  /** "II · Kofer" for a quote, from the part it was taken from. */
  quoteLabel?: string;
}

export interface WhisperList {
  /** The newest one not taken off with × — at the top of the Tiron section. */
  top: ShownWhisper | null;
  /** Everything else, newest first. */
  history: ShownWhisper[];
  /** Came while the panel was closed — the dot on T. */
  unseen: number;
}

const EMPTY: WhisperList = { top: null, history: [], unseen: 0 };

/** Tiron's whispers for the book, live from Dexie: one that arrives in the background shows up at once. */
export function useWhispers(bookId: ID | null): WhisperList {
  const [list, setList] = useState<WhisperList>(EMPTY);

  useEffect(() => {
    if (!bookId) return;
    const subscription = liveQuery(async () => {
      const [whispers, parts] = await Promise.all([listWhispers(bookId), listParts(bookId)]);
      return { whispers, parts };
    }).subscribe({
      next: ({ whispers, parts }) => {
        // A waiting entry whisper belongs to the next Resume, not to this panel.
        const shown = whispers.filter((whisper) => !whisper.waiting).map((whisper): ShownWhisper => {
          const part = whisper.quotePartId ? parts.find((p) => p.id === whisper.quotePartId) : undefined;
          return part ? { ...whisper, quoteLabel: partLabel(part, chapterNumber(parts, part.id)) } : whisper;
        });
        const top = shown.find((whisper) => !whisper.dismissed) ?? null;
        setList({
          top,
          history: shown.filter((whisper) => whisper !== top),
          unseen: shown.filter((whisper) => !whisper.seen).length,
        });
      },
      error: (error) => console.error("Failed to read Tiron's whispers", error),
    });
    return () => subscription.unsubscribe();
  }, [bookId]);

  return bookId ? list : EMPTY;
}
