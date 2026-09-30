"use client";

import { useRef, useState } from "react";
import { copy } from "@/lib/copy";

interface InlineEditProps {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  className?: string;
  /** Chapters may drop their name and fall back to the bare number. */
  allowEmpty?: boolean;
}

export function InlineEdit({ value, onSave, onCancel, className, allowEmpty = false }: InlineEditProps) {
  const [draft, setDraft] = useState(value);
  // Enter and the blur that follows unmounting must not both commit.
  const done = useRef(false);

  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    const title = draft.trim();
    if (commit && (title || allowEmpty) && title !== value) onSave(title);
    else onCancel();
  };

  return (
    <input
      autoFocus
      aria-label={copy.structure.renameLabel}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finish(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          finish(false);
        }
      }}
      className={`w-full rounded-sm bg-transparent px-1 outline outline-1 outline-muted ${className ?? ""}`}
    />
  );
}
