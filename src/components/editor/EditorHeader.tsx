import type { SaveStatus } from "@/hooks/useAutosave";
import { EditorMenu } from "./EditorMenu";

interface EditorHeaderProps {
  chapterTitle: string;
  saveStatus: SaveStatus;
  onToggleStructure: () => void;
  ghostEnabled: boolean;
  onToggleGhost: () => void;
  proofEnabled: boolean;
  onToggleProof: () => void;
}

export function EditorHeader({
  chapterTitle,
  saveStatus,
  onToggleStructure,
  ghostEnabled,
  onToggleGhost,
  proofEnabled,
  onToggleProof,
}: EditorHeaderProps) {
  return (
    <header className="flex items-center justify-end gap-4 px-6 py-4 text-sm text-muted">
      <span>{chapterTitle}</span>
      <EditorMenu
        saveStatus={saveStatus}
        onToggleStructure={onToggleStructure}
        ghostEnabled={ghostEnabled}
        onToggleGhost={onToggleGhost}
        proofEnabled={proofEnabled}
        onToggleProof={onToggleProof}
      />
    </header>
  );
}
