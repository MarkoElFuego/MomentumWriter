"use client";

import type { BookDetailsValue } from "@/components/book/BookDetailsFields";
import type { BookLaterNote } from "@/hooks/useLaterNotes";
import type { PartSummary, RefreshState } from "@/hooks/useStoryMemory";
import type { StuckState } from "@/hooks/useStuck";
import type { WhisperList } from "@/hooks/useWhispers";
import { copy } from "@/lib/copy";
import type { ID, StoryMemory } from "@/lib/db/schema";
import { BookSection } from "./BookSection";
import { LaterSection } from "./LaterSection";
import { ScoreRing } from "./ScoreRing";
import { TopWhisper, WhisperHistory } from "./Whispers";

export interface LanguageRow {
  /** Book score (chapters behind the author) and the value before its last change. */
  value: number;
  previous?: number;
  /** Open underlines in the chapter being written; null → no second line, not clickable. */
  here: { diacritics: number; grammar: number } | null;
}

interface TironPanelProps {
  /** Tiron's whispers (T5): the newest on top, the rest as history. */
  whispers: WhisperList;
  onDismissWhisper: (id: ID) => void;
  stuck: StuckState;
  /** Srce knjige, genre and length — the Knjiga section. */
  book: BookDetailsValue;
  onBookChange: (details: BookDetailsValue) => void;
  /** What Tiron remembers (T2), also in the Knjiga section. */
  bookId: ID;
  memory: StoryMemory | null;
  summaries: PartSummary[];
  refreshState: RefreshState;
  onRefresh: () => void;
  /** Pages left near the end of the draft (T7); null → no countdown. */
  countdown: number | null;
  /** The book has at least one word (POL2: an empty book shows only Srce knjige). */
  hasText: boolean;
  /** Za kasnije (T3): every note in the book; no notes → no section. */
  laterNotes: BookLaterNote[];
  onGoToNote: (note: BookLaterNote) => void;
  onTickOffNote: (note: BookLaterNote) => void;
  /** null → no score yet, no section. */
  language: LanguageRow | null;
  onNextMark: () => void;
  onStuck: () => void;
  onClose: () => void;
  /** Esc from the panel: back to the text, where the cursor was. */
  onBackToText: () => void;
}

/**
 * The right panel: Tiron („Pomozi mi” and its question), Knjiga (Srce knjige —
 * always there, it is how a skipped start screen gets filled in), Za kasnije
 * while the book has notes (T3) and Jezik once the book has a score.
 */
export function TironPanel({
  whispers,
  onDismissWhisper,
  stuck,
  book,
  onBookChange,
  bookId,
  memory,
  summaries,
  refreshState,
  onRefresh,
  countdown,
  hasText,
  laterNotes,
  onGoToNote,
  onTickOffNote,
  language,
  onNextMark,
  onStuck,
  onClose,
  onBackToText,
}: TironPanelProps) {
  // A mouse click must not pull the cursor out of the text — the author keeps typing where they were.
  const keepEditorFocus = (event: React.MouseEvent) => event.preventDefault();
  const loading = stuck.kind === "loading";

  return (
    <aside
      aria-label={copy.tiron.panelLabel}
      className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-rule px-[1.125rem] pb-8 pt-4 text-[0.8125rem]"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onBackToText();
        }
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="panel-caption m-0">{copy.tiron.panelLabel}</h2>
        <button type="button" aria-label={copy.tiron.close} title={copy.tiron.close} className="ui-button px-1 text-muted" onClick={onClose}>
          ×
        </button>
      </div>

      <section>
        {whispers.top && <TopWhisper whisper={whispers.top} onDismiss={() => onDismissWhisper(whispers.top!.id)} />}
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
        <WhisperHistory history={whispers.history} />
      </section>

      <BookSection
        details={book}
        onChange={onBookChange}
        bookId={bookId}
        memory={memory}
        summaries={summaries}
        refreshState={refreshState}
        onRefresh={onRefresh}
        countdown={countdown}
        hasText={hasText}
      />

      <LaterSection notes={laterNotes} onGoTo={onGoToNote} onTickOff={onTickOffNote} />

      {language && <LanguageSection row={language} onNextMark={onNextMark} />}
    </aside>
  );
}

/** Jezik (POL2): the score as a ring, the change since last time (↑ and ↓ — odluka autora), what is open here. */
function LanguageSection({ row, onNextMark }: { row: LanguageRow; onNextMark: () => void }) {
  const change = row.previous === undefined ? 0 : row.value - row.previous;
  const content = (
    <span className="flex items-center gap-3">
      <ScoreRing value={row.value} />
      <span className="min-w-0">
        <span className="block text-[0.8125rem] text-ink">
          {copy.tiron.language}
          {change !== 0 && (
            <span className="ml-1 tabular-nums text-xs text-muted">
              {change > 0 ? copy.tiron.languageUp(change) : copy.tiron.languageDown(-change)}
            </span>
          )}
        </span>
        {row.here && (
          <span className="mt-0.5 block text-xs text-muted">
            {copy.tiron.languageHere(row.here.diacritics, row.here.grammar)} · <span className="text-accent">{copy.tiron.languageShow}</span>
          </span>
        )}
      </span>
    </span>
  );
  return (
    <section className="panel-section">
      {row.here ? (
        <button type="button" title={copy.tiron.languageNext} className="ui-button block w-full text-left" onClick={onNextMark}>
          {content}
        </button>
      ) : (
        <div>{content}</div>
      )}
    </section>
  );
}
