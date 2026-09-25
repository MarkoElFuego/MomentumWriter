import { copy } from "@/lib/copy";

interface EditorFooterProps {
  wordsToday: number;
}

export function EditorFooter({ wordsToday }: EditorFooterProps) {
  return (
    <footer className="flex items-center justify-between px-6 py-4 text-sm text-muted">
      <span className="tabular-nums">{copy.editor.wordsToday(wordsToday)}</span>
      <button type="button" className="ui-button px-3 py-1">
        {copy.editor.sparkButton}
      </button>
    </footer>
  );
}
