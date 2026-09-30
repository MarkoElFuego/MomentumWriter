"use client";

import { useEffect, type RefObject } from "react";
import type { Editor } from "@tiptap/react";

// Small moves are left alone so the page doesn't twitch on every keystroke.
const TOLERANCE_PX = 12;

/** Typewriter mode: the cursor line stays around the middle of the scroll area. */
export function useTypewriterScroll(
  editor: Editor | null,
  scrollRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!editor || !enabled) return;

    const center = () => {
      const scroller = scrollRef.current;
      if (!scroller || editor.isDestroyed) return;
      let caret: { top: number; bottom: number };
      try {
        caret = editor.view.coordsAtPos(editor.state.selection.head);
      } catch {
        return;
      }
      const box = scroller.getBoundingClientRect();
      const delta = (caret.top + caret.bottom) / 2 - (box.top + box.height / 2);
      if (Math.abs(delta) > TOLERANCE_PX) scroller.scrollTop += delta;
    };

    // After ProseMirror's own scroll-into-view for the same change.
    const schedule = () => requestAnimationFrame(center);
    schedule();
    editor.on("selectionUpdate", schedule);
    editor.on("update", schedule);
    return () => {
      editor.off("selectionUpdate", schedule);
      editor.off("update", schedule);
    };
  }, [editor, scrollRef, enabled]);
}
