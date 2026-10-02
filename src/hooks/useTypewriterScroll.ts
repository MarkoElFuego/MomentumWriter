"use client";

import { useEffect, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { TYPEWRITER_CLICK_DELAY_MS } from "@/lib/timing";

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

    // Scrolling under a dragging mouse extends the selection, which scrolls
    // again — the selection would run to the end of the text. So the mouse
    // never scrolls while it is down; a single click centers once it is clear
    // it wasn't the start of a double click. Typing and arrows center as usual.
    // Mouse events, not pointer events: only they carry the click count in `detail`.
    let pointerDown = false;
    let clickTimer: ReturnType<typeof setTimeout> | undefined;
    const onMouseDown = () => {
      pointerDown = true;
      clearTimeout(clickTimer);
    };
    const onMouseUp = (event: MouseEvent) => {
      if (!pointerDown) return;
      pointerDown = false;
      if (event.detail !== 1) return;
      clickTimer = setTimeout(center, TYPEWRITER_CLICK_DELAY_MS);
    };
    editor.view.dom.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);

    const center = () => {
      const scroller = scrollRef.current;
      if (!scroller || editor.isDestroyed) return;
      if (pointerDown || !editor.state.selection.empty) return;
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

    // After ProseMirror's own scroll-into-view for the same change. Not on
    // open or when switched on — the chapter starts at its top, title first.
    const schedule = () => requestAnimationFrame(center);
    editor.on("selectionUpdate", schedule);
    editor.on("update", schedule);
    return () => {
      clearTimeout(clickTimer);
      editor.view.dom.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      editor.off("selectionUpdate", schedule);
      editor.off("update", schedule);
    };
  }, [editor, scrollRef, enabled]);
}
