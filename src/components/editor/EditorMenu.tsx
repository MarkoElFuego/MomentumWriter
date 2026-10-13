"use client";

import Link from "next/link";
import { copy } from "@/lib/copy";
import type { TironMode } from "@/lib/tironMode";
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

/** Tih · prisutan · isključen — one row of three in the menu (POL3). */
const MODE_ORDER: TironMode[] = ["quiet", "present", "off"];

/** On/off item: the name, and a tick on the right while it is on. */
function Check({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={on} className="ui-button flex w-full items-center gap-6 whitespace-nowrap px-3 py-2 text-left" onClick={onClick}>
      <span className="flex-1">{label}</span>
      <span aria-hidden="true" className={`text-accent ${on ? "" : "invisible"}`}>
        ✓
      </span>
    </button>
  );
}

/** ··· — the settings that don't have their own icon in the toolbar, in groups. */
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
  const rule = "my-1 border-t border-rule";
  return (
    <ToolbarMenu
      label={copy.editor.menuLabel}
      title={copy.editor.menuLabel}
      align="right"
      button={<span aria-hidden="true">···</span>}
      menuClassName="min-w-64"
      open={open}
      onOpenChange={onOpenChange}
    >
      <Check on={ghostEnabled} label={copy.menu.ghost} onClick={onToggleGhost} />
      <Check on={proofEnabled} label={copy.menu.proof} onClick={onToggleProof} />
      <Check on={hyphens} label={copy.menu.hyphens} onClick={onToggleHyphens} />
      <div className={rule} role="separator" />
      <div role="group" aria-label={copy.menu.tiron} className="flex items-center gap-3 whitespace-nowrap px-3 py-1.5">
        <span className="flex-1">{copy.menu.tiron}</span>
        <span className="flex rounded-md border border-rule p-0.5 text-xs">
          {MODE_ORDER.map((mode) => (
            <button
              key={mode}
              type="button"
              role="menuitemradio"
              aria-checked={tironMode === mode}
              title={`${copy.menu.tironModes[mode]} — ${copy.menu.tironModeHints[mode]}`}
              className={`tiron-mode ui-button rounded px-2 py-1${tironMode === mode ? " tiron-mode-on" : ""}`}
              onClick={() => onTironMode(mode)}
            >
              {copy.menu.tironModesShort[mode]}
            </button>
          ))}
        </span>
      </div>
      <div className={rule} role="separator" />
      <button type="button" role="menuitem" className={item} onClick={onExport}>
        {copy.menu.exportBook}
      </button>
      {onFinishDraft && (
        <button type="button" role="menuitem" className={item} onClick={onFinishDraft}>
          {copy.menu.finishDraft}
        </button>
      )}
      <div className={rule} role="separator" />
      <Link href="/" role="menuitem" className="ui-button block px-3 py-2">
        {copy.menu.allBooks}
      </Link>
    </ToolbarMenu>
  );
}
