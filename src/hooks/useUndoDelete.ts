"use client";

import { useSyncExternalStore } from "react";
import { purgeDeletedBooks } from "@/lib/db/books";
import { purgeDeletedParts } from "@/lib/db/parts";
import type { ID, PartKind } from "@/lib/db/schema";
import { UNDO_DELETE_MS } from "@/lib/timing";

export type PendingDelete =
  | {
      partId: ID;
      kind: PartKind;
      /** It was open in the editor — undo goes back to it. */
      wasOpen: boolean;
    }
  | { kind: "book"; bookId: ID };

// Module state, not component state: deleting the open part moves the editor
// to a neighbour, which remounts the writing screen — the offer has to survive.
let pending: PendingDelete | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(next: PendingDelete | null) {
  pending = next;
  listeners.forEach((listener) => listener());
}

function purge() {
  purgeDeletedParts().catch((error) => console.error("Failed to remove deleted parts", error));
  purgeDeletedBooks().catch((error) => console.error("Failed to remove deleted books", error));
}

/** Shows "Poništi" for UNDO_DELETE_MS. A newer deletion replaces the offer; the older one becomes final. */
export function offerUndo(next: PendingDelete) {
  clearTimeout(timer);
  set(next);
  timer = setTimeout(() => {
    set(null);
    purge();
  }, UNDO_DELETE_MS);
}

/** Takes the offer (once) so the part can be restored. */
export function takeUndo(): PendingDelete | null {
  const taken = pending;
  clearTimeout(timer);
  set(null);
  return taken;
}

/** On start: parts and books deleted earlier (closed tab, reload) whose undo time is over go for good. */
export function purgeExpiredDeletes() {
  purge();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUndoDelete(): PendingDelete | null {
  return useSyncExternalStore(
    subscribe,
    () => pending,
    () => null,
  );
}
