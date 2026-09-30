"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AppearanceControls } from "@/hooks/useAppearance";
import type { SaveStatus } from "@/hooks/useAutosave";
import { copy } from "@/lib/copy";
import { THEME_PAPER, THEMES } from "@/lib/themes";

interface EditorMenuProps {
  saveStatus: SaveStatus;
  onToggleStructure: () => void;
  ghostEnabled: boolean;
  onToggleGhost: () => void;
  proofEnabled: boolean;
  onToggleProof: () => void;
  appearance: AppearanceControls;
}

export function EditorMenu({
  saveStatus,
  onToggleStructure,
  ghostEnabled,
  onToggleGhost,
  proofEnabled,
  onToggleProof,
  appearance,
}: EditorMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={copy.editor.menuLabel}
        aria-expanded={open}
        aria-haspopup="true"
        className="ui-button px-2"
        onClick={() => setOpen((v) => !v)}
      >
        ···
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-md border border-muted/30 bg-paper p-1 text-sm shadow-sm">
          <p role="status" aria-live="polite" className="px-3 py-2 text-muted">
            {copy.save[saveStatus]}
          </p>
          <button
            type="button"
            className="ui-button flex w-full justify-between px-3 py-2 text-left"
            onClick={() => {
              setOpen(false);
              onToggleStructure();
            }}
          >
            <span>{copy.menu.structure}</span>
            <span className="opacity-70">{copy.menu.structureShortcut}</span>
          </button>
          <button
            type="button"
            aria-pressed={ghostEnabled}
            className="ui-button block w-full px-3 py-2 text-left"
            onClick={onToggleGhost}
          >
            {ghostEnabled ? copy.menu.ghostOn : copy.menu.ghostOff}
          </button>
          <button
            type="button"
            aria-pressed={proofEnabled}
            className="ui-button block w-full px-3 py-2 text-left"
            onClick={onToggleProof}
          >
            {proofEnabled ? copy.menu.proofOn : copy.menu.proofOff}
          </button>
          <div role="group" aria-label={copy.menu.themes} className="flex gap-2 px-3 py-2">
            {THEMES.map((theme) => (
              <button
                key={theme}
                type="button"
                title={copy.menu.themeNames[theme]}
                aria-label={copy.menu.themeNames[theme]}
                aria-pressed={appearance.theme === theme}
                className="theme-swatch"
                style={{ backgroundColor: THEME_PAPER[theme] }}
                onClick={() => appearance.onTheme(theme)}
              />
            ))}
          </div>
          <button
            type="button"
            aria-pressed={appearance.focusMode}
            className="ui-button block w-full px-3 py-2 text-left"
            onClick={appearance.onToggleFocus}
          >
            {appearance.focusMode ? copy.menu.focusOn : copy.menu.focusOff}
          </button>
          <button
            type="button"
            aria-pressed={appearance.typewriter}
            className="ui-button block w-full px-3 py-2 text-left"
            onClick={appearance.onToggleTypewriter}
          >
            {appearance.typewriter ? copy.menu.typewriterOn : copy.menu.typewriterOff}
          </button>
          <Link href="/" className="ui-button block px-3 py-2">
            {copy.menu.allBooks}
          </Link>
        </div>
      )}
    </div>
  );
}
