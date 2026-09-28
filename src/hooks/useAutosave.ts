"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "saved" | "saving" | "error";

const RETRY_MS = 3000;

/**
 * Debounced save that also flushes when the tab hides, the page unloads
 * or the component unmounts. A failed save is retried — never dropped.
 */
export function useAutosave(save: () => Promise<void>, delayMs = 800) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const saveRef = useRef(save);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const failed = useRef(false);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return;
    dirty.current = false;
    setStatus("saving");
    try {
      await saveRef.current();
      failed.current = false;
      if (!dirty.current) setStatus("saved");
    } catch (error) {
      console.error("Autosave failed", error);
      dirty.current = true;
      failed.current = true;
      setStatus("error");
      timer.current = setTimeout(() => void flush(), RETRY_MS);
    }
  }, []);

  const schedule = useCallback(() => {
    dirty.current = true;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delayMs);
  }, [flush, delayMs]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      void flush();
      // Only ask the browser to hold the page if the last save actually failed.
      if (failed.current) event.preventDefault();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flush();
    };
  }, [flush]);

  return { status, schedule, flush };
}
