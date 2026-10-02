"use client";

import { useEffect, useState, type RefObject } from "react";

// Tailwind w-64 / w-72 and the text column's px-6 on both sides.
const LEFT_PANEL_PX = 256;
const RIGHT_PANEL_PX = 288;
const COLUMN_PADDING_PX = 48;

/**
 * True when the open panels would squeeze the text below ~60 characters — then
 * they open over the text instead of beside it. The probe is 60 characters in
 * the theme's text font, so it follows the theme (Courier Prime is wider).
 */
export function usePanelsOverlay(
  probeRef: RefObject<HTMLElement | null>,
  leftOpen: boolean,
  rightOpen: boolean,
  /** The probe exists only once the part has loaded. */
  ready: boolean,
): boolean {
  const [overlay, setOverlay] = useState(false);

  useEffect(() => {
    const probe = probeRef.current;
    if (!probe) return;
    const measure = () => {
      const panels = (leftOpen ? LEFT_PANEL_PX : 0) + (rightOpen ? RIGHT_PANEL_PX : 0);
      const room = window.innerWidth - panels - COLUMN_PADDING_PX;
      setOverlay(panels > 0 && room < probe.offsetWidth);
    };
    measure();
    // The probe resizes when the font loads or the theme changes it.
    const observer = new ResizeObserver(measure);
    observer.observe(probe);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [probeRef, leftOpen, rightOpen, ready]);

  return overlay;
}
