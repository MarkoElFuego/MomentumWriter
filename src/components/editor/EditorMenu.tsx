"use client";

import Link from "next/link";
import { copy } from "@/lib/copy";
import { TIRON_MODES, type TironMode } from "@/lib/tironMode";
import { ToolbarMenu } from "./ToolbarMenu";

export interface EditorMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ghostEnabled: boolean;
  onToggleGhost: () => void;
  proofEnabled: boolean;
  onToggleProof: () => void;
  /** Hyphenation of justified text. */
  hyphens: boolean;
  onToggleHyphens: () => void;
  /** Tiron's whispers: present / quiet / off (T5). */
  tironMode: TironMode;
  onTironMode: (mode: TironMode) => void;
  /** „Označi kraj nacrta” (T7); undefined once the draft is finished — no item then. */
  onFinishDraft?: () => void;
  /** „Izvezi PDF…” — the export dialog (ZADATAK_IZVOZ P4). */
  onExport: () => void;
}

/** ··· — the settings that don't have their own icon in the toolbar. */
export function EditorMenu({
  open,
  onOpenChange,
  ghostEnabled,
  onToggleGhost,
  proofEnabled,
  onToggleProof,
  hyphens,
  onToggleHyphens,
  tironMode,
  onTironMode,
  onFinishDraft,
  onExport,
}: EditorMenuProps) {
  const item = "ui-button block w-full whitespace-nowrap px-3 py-2 text-left";
  return (
    <ToolbarMenu
      label={copy.editor.menuLabel}
      title={copy.editor.menuLabel}
      align="right"
      button={<span aria-hidden="true">···</span>}
      open={open}
      onOpenChange={onOpenChange}
    >
      <button type="button" role="menuitemcheckbox" aria-checked={ghostEnabled} className={item} onClick={onToggleGhost}>
        {ghostEnabled ? copy.menu.ghostOn : copy.menu.ghostOff}
      </button>
      <button type="button" role="menuitemcheckbox" aria-checked={proofEnabled} className={item} onClick={onToggleProof}>
        {proofEnabled ? copy.menu.proofOn : copy.menu.proofOff}
      </button>
      <button type="button" role="menuitemcheckbox" aria-checked={hyphens} className={item} onClick={onToggleHyphens}>
        {hyphens ? copy.menu.hyphensOn : copy.menu.hyphensOff}
      </button>
      <div role="group" aria-label={copy.tiron.toggle} className="border-t border-muted/20">
        {TIRON_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            role="menuitemradio"
            aria-checked={tironMode === mode}
            title={copy.menu.tironModeHints[mode]}
            className={`${item}${tironMode === mode ? " text-ink" : " text-muted"}`}
            onClick={() => onTironMode(mode)}
          >
            {copy.menu.tironModes[mode]}
          </button>
        ))}
      </div>
      {onFinishDraft && (
        <button type="button" role="menuitem" className={`${item} border-t border-muted/20`} onClick={onFinishDraft}>
          {copy.menu.finishDraft}
        </button>
      )}
      <button type="button" role="menuitem" className={`${item} border-t border-muted/20`} onClick={onExport}>
        {copy.menu.exportPdf}
      </button>
      <Link href="/" role="menuitem" className="ui-button block border-t border-muted/20 px-3 py-2">
        {copy.menu.allBooks}
      </Link>
    </ToolbarMenu>
  );
}
