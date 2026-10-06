"use client";

import { useEffect } from "react";
import { whisperSessionEndIfDue } from "@/components/tiron/whisper";
import type { ID } from "@/lib/db/schema";

// Often enough for "20 minutes without a save"; a hidden tab may run it less
// often (browsers slow timers down), which only delays the whisper a little.
const CHECK_EVERY_MS = 60_000;

/**
 * The end of a writing session (T4 rules) → Tiron's closing whisper (T5): no
 * save for 20 minutes, or the tab hidden for 10. On opening, a session that
 * ended with a closed tab gets its whisper too.
 */
export function useSessionEnd(bookId: ID | null) {
  useEffect(() => {
    if (!bookId) return;
    let hiddenSince: number | undefined = document.visibilityState === "hidden" ? Date.now() : undefined;
    const check = () => void whisperSessionEndIfDue(bookId, hiddenSince);

    const onVisibility = () => {
      hiddenSince = document.visibilityState === "hidden" ? Date.now() : undefined;
    };
    document.addEventListener("visibilitychange", onVisibility);
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(timer);
    };
  }, [bookId]);
}
