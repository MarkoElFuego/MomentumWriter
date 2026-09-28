import type { SaveStatus } from "@/hooks/useAutosave";
import { EditorMenu } from "./EditorMenu";

interface EditorHeaderProps {
  chapterTitle: string;
  saveStatus: SaveStatus;
  onToggleStructure: () => void;
}

export function EditorHeader({ chapterTitle, saveStatus, onToggleStructure }: EditorHeaderProps) {
  return (
    <header className="flex items-center justify-end gap-4 px-6 py-4 text-sm text-muted">
      <span>{chapterTitle}</span>
      <EditorMenu saveStatus={saveStatus} onToggleStructure={onToggleStructure} />
    </header>
  );
}
