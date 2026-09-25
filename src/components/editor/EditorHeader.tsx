import { copy } from "@/lib/copy";

interface EditorHeaderProps {
  chapterTitle: string;
}

export function EditorHeader({ chapterTitle }: EditorHeaderProps) {
  return (
    <header className="flex items-center justify-end gap-4 px-6 py-4 text-sm text-muted">
      <span>{chapterTitle}</span>
      <button type="button" aria-label={copy.editor.menuLabel} className="ui-button px-2">
        ···
      </button>
    </header>
  );
}
