"use client";

import type { StuckState } from "@/hooks/useStuck";
import { copy } from "@/lib/copy";

interface TironPanelProps {
  stuck: StuckState;
  onStuck: () => void;
  onClose: () => void;
  /** Esc from the panel: back to the text, where the cursor was. */
  onBackToText: () => void;
}

/**
 * The right panel. For now only the Tiron section: „Zapeo sam” and its
 * question. Knjiga, Za kasnije and Jezik appear with the phases that give them
 * content — never as empty or "coming soon" sections.
 */
export function TironPanel({ stuck, onStuck, onClose, onBackToText }: TironPanelProps) {
  // A mouse click must not pull the cursor out of the text — the author keeps typing where they were.
  const keepEditorFocus = (event: React.MouseEvent) => event.preventDefault();
  const loading = stuck.kind === "loading";

  return (
    <aside
      aria-label={copy.tiron.panelLabel}
      className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-muted/20 px-4 py-4 text-sm"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onBackToText();
        }
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wider text-muted">{copy.tiron.panelLabel}</h2>
        <button type="button" aria-label={copy.tiron.close} className="ui-button px-1" onClick={onClose}>
          ×
        </button>
      </div>

      <section>
        <button
          type="button"
          className="tiron-stuck ui-button w-full px-3 py-2"
          disabled={loading}
          onMouseDown={keepEditorFocus}
          onClick={onStuck}
        >
          {copy.tiron.stuck}
        </button>

        <div aria-live="polite" aria-busy={loading} className="mt-4">
          {loading && (
            <div className="space-y-2" aria-label={copy.tiron.thinking}>
              <div className="tiron-skeleton h-3 w-11/12" />
              <div className="tiron-skeleton h-3 w-2/3" />
            </div>
          )}
          {stuck.kind === "ready" && (
            <>
              <p className="tiron-question text-ink">{stuck.question}</p>
              <button
                type="button"
                className="ui-button mt-2 text-xs underline"
                onMouseDown={keepEditorFocus}
                onClick={onStuck}
              >
                {copy.tiron.another}
              </button>
            </>
          )}
          {stuck.kind === "tooShort" && <p className="text-muted">{copy.tiron.tooShort}</p>}
          {stuck.kind === "error" && <p className="text-muted">{copy.tiron.unavailable}</p>}
        </div>
      </section>
    </aside>
  );
}
