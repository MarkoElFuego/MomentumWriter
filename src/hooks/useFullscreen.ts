"use client";

import { useCallback, useEffect, useState } from "react";

export interface FullscreenControls {
  supported: boolean;
  active: boolean;
  toggle: () => void;
}

/** Fullscreen API — Esc is handled by the browser and reported through `fullscreenchange`. */
export function useFullscreen(): FullscreenControls {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    setSupported(document.fullscreenEnabled);
    const onChange = () => setActive(document.fullscreenElement !== null);
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
    const request = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    request.catch((error) => console.error("Fullscreen failed", error));
  }, []);

  return { supported, active, toggle };
}
