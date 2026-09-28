"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SaveStatus } from "@/hooks/useAutosave";
import { copy } from "@/lib/copy";

interface EditorMenuProps {
  saveStatus: SaveStatus;
  onToggleStructure: () => void;
  ghostEnabled: boolean;
  onToggleGhost: () => void;
}

export function EditorMenu({ saveStatus, onToggleStructure, ghostEnabled, onToggleGhost }: EditorMenuProps) {
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
          <Link href="/" className="ui-button block px-3 py-2">
            {copy.menu.allBooks}
          </Link>
        </div>
      )}
    </div>
  );
}
