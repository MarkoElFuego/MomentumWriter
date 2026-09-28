import { copy } from "@/lib/copy";

interface EditorFooterProps {
  wordsToday: number;
  sparkOpen: boolean;
  onSpark: () => void;
}

export function EditorFooter({ wordsToday, sparkOpen, onSpark }: EditorFooterProps) {
  return (
    <footer className="flex items-center justify-between px-6 py-4 text-sm text-muted">
      <span className="tabular-nums">{copy.editor.wordsToday(wordsToday)}</span>
      <button
        type="button"
        className="ui-button px-3 py-1"
        aria-expanded={sparkOpen}
        aria-haspopup="dialog"
        aria-keyshortcuts="Tab Control+J Meta+J"
        title={copy.spark.shortcut}
        onClick={onSpark}
      >
        {copy.editor.sparkButton}
      </button>
    </footer>
  );
}
