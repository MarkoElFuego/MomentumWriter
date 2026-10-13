"use client";

import { useState } from "react";
import type { ShownWhisper, WhisperList } from "@/hooks/useWhispers";
import { copy } from "@/lib/copy";

/** The history shows this many before „Prikaži sve”. */
const HISTORY_SHOWN = 10;

/** The newest whisper in the book's font, a thin accent line on its left, where it came from under it; × (not on Resume). */
export function TopWhisper({ whisper, onDismiss }: { whisper: ShownWhisper; onDismiss?: () => void }) {
  return (
    <div className="mb-1 flex items-start gap-2">
      <div className="tiron-whisper-box min-w-0 flex-1">
        <p className="tiron-whisper text-ink">{whisper.text}</p>
        <p className="mt-1 text-[0.6875rem] text-muted">{copy.tiron.whisperFrom[whisper.moment]}</p>
        {whisper.quote && (
          <figure className="mt-2">
            <blockquote className="font-serif italic text-ink">{whisper.quote}</blockquote>
            {whisper.quoteLabel && (
              <figcaption className="mt-0.5 text-xs text-muted">{copy.tiron.quoteFrom(whisper.quoteLabel)}</figcaption>
            )}
          </figure>
        )}
      </div>
      {onDismiss && (
        <button type="button" aria-label={copy.tiron.dismiss} title={copy.tiron.dismiss} className="ui-button px-1 text-muted" onClick={onDismiss}>
          ×
        </button>
      )}
    </div>
  );
}

/** Earlier whispers, small: the last ten, then „Prikaži sve”. */
export function WhisperHistory({ history }: { history: WhisperList["history"] }) {
  const [all, setAll] = useState(false);
  if (history.length === 0) return null;
  const shown = all ? history : history.slice(0, HISTORY_SHOWN);
  return (
    <div className="mt-6">
      <h3 className="panel-caption">{copy.tiron.history}</h3>
      <ul className="mt-1 space-y-1.5 text-xs text-muted">
        {shown.map((whisper) => (
          <li key={whisper.id}>{whisper.text}</li>
        ))}
      </ul>
      {!all && history.length > HISTORY_SHOWN && (
        <button type="button" className="ui-button mt-1 text-xs underline" onClick={() => setAll(true)}>
          {copy.tiron.showAll(history.length)}
        </button>
      )}
    </div>
  );
}
