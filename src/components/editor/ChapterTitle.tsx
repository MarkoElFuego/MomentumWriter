"use client";

import { forwardRef } from "react";
import { copy } from "@/lib/copy";
import { toRoman } from "@/lib/text/toRoman";

interface ChapterTitleProps {
  title: string;
  /** Chapters show their number above the title; front/back matter don't have one. */
  number: number | undefined;
  onChange: (title: string) => void;
  /** Enter or ↓ — on to the beginning of the text. */
  onLeave: () => void;
}

/** The part's title above the text — the same value as in the table of contents. */
export const ChapterTitle = forwardRef<HTMLInputElement, ChapterTitleProps>(function ChapterTitle(
  { title, number, onChange, onLeave },
  ref,
) {
  return (
    <div className="chapter-title mb-10 text-center">
      {number !== undefined && (
        <p aria-hidden="true" className="chapter-number text-muted">
          {toRoman(number)}
        </p>
      )}
      <input
        ref={ref}
        type="text"
        value={title}
        placeholder={copy.structure.titlePlaceholder}
        aria-label={number !== undefined ? copy.structure.chapterTitleLabel(number) : copy.structure.titlePlaceholder}
        spellCheck
        lang="sr-Latn"
        className="chapter-title-input"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "ArrowDown") {
            event.preventDefault();
            onLeave();
          }
        }}
      />
    </div>
  );
});
