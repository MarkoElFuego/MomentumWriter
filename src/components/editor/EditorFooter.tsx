import { copy } from "@/lib/copy";

/** "347 reči danas" — small, bottom left; fades together with the toolbar. */
export function EditorFooter({ wordsToday, faded }: { wordsToday: number; faded: boolean }) {
  return (
    <footer className={`fades px-6 py-3 text-xs text-muted${faded ? " is-faded" : ""}`}>
      <span className="tabular-nums">{copy.editor.wordsToday(wordsToday)}</span>
    </footer>
  );
}
