"use client";

import { useEffect, useRef } from "react";
import type { SparkAnchor } from "@/components/spark/SparkPalette";
import { copy } from "@/lib/copy";
import type { OpenProofMark } from "./proofMarks";

const GAP = 6;
const EDGE = 16;
const ROOM_BELOW = 140;

// Under the word, or above it near the bottom of the window.
function placeAt(anchor: SparkAnchor): React.CSSProperties {
  const left = Math.min(Math.max(anchor.left, EDGE), window.innerWidth - 260 - EDGE);
  return window.innerHeight - anchor.bottom >= ROOM_BELOW
    ? { position: "fixed", left, top: anchor.bottom + GAP }
    : { position: "fixed", left, bottom: window.innerHeight - anchor.top + GAP };
}

interface ProofPopoverProps {
  mark: OpenProofMark;
  anchor: SparkAnchor;
  onAccept: () => void;
  onReject: () => void;
  onAcceptDiacritics: () => void;
  /** `refocus`: give the text its cursor back (Esc), not after a click elsewhere. */
  onClose: (refocus: boolean) => void;
}

export function ProofPopover({ mark, anchor, onAccept, onReject, onAcceptDiacritics, onClose }: ProofPopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);

  // Keyboard-opened (Alt+Enter) → Enter accepts right away; a click keeps typing in the text.
  useEffect(() => {
    if (mark.focus) acceptRef.current?.focus();
  }, [mark.id, mark.focus]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={copy.proofread.label}
      style={placeAt(anchor)}
      className="z-30 rounded-md border border-muted/30 bg-paper p-1 text-sm shadow-sm"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose(true);
        }
      }}
    >
      <p className="px-3 pb-1 pt-2">
        <span className="text-muted line-through decoration-muted/60">{mark.edit.from}</span>
        <span className="px-2 text-muted" aria-hidden="true">
          →
        </span>
        <span>{mark.edit.to}</span>
        <span className="sr-only">{copy.proofread.describe(mark.edit.from, mark.edit.to)}</span>
      </p>
      <div className="flex gap-1 px-1 pb-1">
        <button ref={acceptRef} type="button" className="ui-button px-2 py-1" onClick={onAccept}>
          {copy.proofread.accept}
        </button>
        <button type="button" className="ui-button px-2 py-1" onClick={onReject}>
          {copy.proofread.reject}
        </button>
      </div>
      {mark.diacriticsInParagraph > 1 && (
        <button type="button" className="ui-button block w-full px-3 py-1 text-left" onClick={onAcceptDiacritics}>
          {copy.proofread.acceptDiacritics(mark.diacriticsInParagraph)}
        </button>
      )}
    </div>
  );
}
