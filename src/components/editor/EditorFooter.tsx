import { copy } from "@/lib/copy";

export function EditorFooter({ wordsToday }: { wordsToday: number }) {
  return (
    <footer className="px-6 py-4 text-sm text-muted">
      <span className="tabular-nums">{copy.editor.wordsToday(wordsToday)}</span>
    </footer>
  );
}
