"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { liveQuery } from "dexie";
import { updateStoryMemory } from "@/components/tiron/updateMemory";
import { compactMemory, getMemory } from "@/lib/db/memory";
import { chapterNumber, listParts, partLabel } from "@/lib/db/parts";
import type { ID, StoryMemory } from "@/lib/db/schema";

export interface PartSummary {
  id: ID;
  label: string;
  summary: string;
}

/** „Osveži”: idle, reading, or how the last read ended (shown until the next one). */
export type RefreshState = "idle" | "reading" | "unchanged" | "empty" | "failed";

/**
 * What Tiron remembers about the book, live from Dexie: a background read that
 * finishes after the author moved to another chapter still shows up in the panel.
 * `flush` saves the open text before „Osveži” reads it.
 */
export function useStoryMemory(bookId: ID | null, partId: ID, flush: () => Promise<void>) {
  const [memory, setMemory] = useState<StoryMemory | null>(null);
  const [summaries, setSummaries] = useState<PartSummary[]>([]);
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");

  useEffect(() => {
    if (!bookId) return;
    const subscription = liveQuery(async () => {
      const [memory, parts] = await Promise.all([getMemory(bookId), listParts(bookId)]);
      return { memory, parts };
    }).subscribe({
      next: ({ memory, parts }) => {
        setMemory(memory);
        setSummaries(
          parts
            .filter((part) => part.summary)
            .map((part) => ({ id: part.id, label: partLabel(part, chapterNumber(parts, part.id)), summary: part.summary! })),
        );
      },
      error: (error) => console.error("Failed to read the story memory", error),
    });
    return () => subscription.unsubscribe();
  }, [bookId]);

  const refresh = useCallback(async () => {
    setRefreshState("reading");
    await flush();
    const result = await updateStoryMemory(partId, { force: true });
    setRefreshState(result === "updated" ? "idle" : result);
  }, [flush, partId]);

  // Only Tiron's calls get this — never ghost.
  const compact = useMemo(() => compactMemory(memory), [memory]);

  return { memory, summaries, compact, refreshState, refresh };
}
