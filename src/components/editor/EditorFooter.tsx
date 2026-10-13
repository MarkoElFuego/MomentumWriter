import { copy } from "@/lib/copy";

/**
 * "347 reči danas" — small, bottom left; fades together with the toolbar.
 * Nothing while today is still 0 (odluka autora, POL3): an empty page has no numbers.
 */
export function EditorFooter({ wordsToday, faded }: { wordsToday: number; faded: boolean }) {
  return (
    <footer className={`fades px-6 py-3 text-xs text-muted${faded ? " is-faded" : ""}`}>
      {/* The footer keeps its height, so the text doesn't jump at the first word. */}
      <span className="tabular-nums">{wordsToday > 0 ? copy.editor.wordsToday(wordsToday) : "\u00a0"}</span>
    </footer>
  );
}
