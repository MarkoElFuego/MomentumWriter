"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { TOOLBAR_FADE_AFTER_TYPING_MS, TOOLBAR_TYPING_GAP_MS } from "@/lib/timing";

// Typewriter scroll makes browsers fire mousemove without the mouse moving.
const MIN_MOUSE_MOVE_PX = 4;
// Fullscreen: the bar shows only while the mouse is this close to the top.
const FULLSCREEN_REVEAL_PX = 40;

/**
 * The toolbar fades after a stretch of typing and comes back on a real mouse
 * move, on keyboard focus (Alt+F10 jumps into it) and whenever one of its
 * menus is open. In fullscreen it stays hidden unless the mouse is at the very
 * top, focus is in it or a menu is open.
 */
export function useToolbarFade(
  editor: Editor | null,
  toolbarRef: RefObject<HTMLElement | null>,
  menuOpen: boolean,
  fullscreen = false,
): boolean {
  const [faded, setFaded] = useState(false);
  const [nearTop, setNearTop] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const typingSince = useRef<number | null>(null);
  const lastKeyAt = useRef(0);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const now = Date.now();
      // A pause ends the stretch; the next key starts a new one.
      if (typingSince.current === null || now - lastKeyAt.current > TOOLBAR_TYPING_GAP_MS) {
        typingSince.current = now;
      }
      lastKeyAt.current = now;
      if (now - typingSince.current >= TOOLBAR_FADE_AFTER_TYPING_MS) setFaded(true);
    };
    dom.addEventListener("keydown", onKeyDown);
    return () => dom.removeEventListener("keydown", onKeyDown);
  }, [editor]);

  useEffect(() => {
    let last: { x: number; y: number } | null = null;
    const show = () => {
      typingSince.current = null;
      setFaded(false);
    };
    const onMouseMove = (event: MouseEvent) => {
      const moved =
        !last ||
        Math.abs(event.screenX - last.x) + Math.abs(event.screenY - last.y) >= MIN_MOUSE_MOVE_PX;
      last = { x: event.screenX, y: event.screenY };
      // Over the bar itself counts too — its buttons reach below the reveal strip.
      setNearTop(event.clientY <= FULLSCREEN_REVEAL_PX || !!toolbarRef.current?.contains(event.target as Node));
      if (moved) show();
    };
    const onFocusIn = () => {
      setFocusInside(true);
      show();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!toolbarRef.current?.contains(event.relatedTarget as Node | null)) setFocusInside(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === "F10") {
        event.preventDefault();
        show();
        toolbarRef.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus();
      }
    };
    const toolbar = toolbarRef.current;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    toolbar?.addEventListener("focusin", onFocusIn);
    toolbar?.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      toolbar?.removeEventListener("focusin", onFocusIn);
      toolbar?.removeEventListener("focusout", onFocusOut);
    };
    // `editor` too: the toolbar is rendered only once the part has loaded.
  }, [toolbarRef, editor]);

  if (menuOpen) return false;
  if (fullscreen) return !nearTop && !focusInside;
  return faded;
}
