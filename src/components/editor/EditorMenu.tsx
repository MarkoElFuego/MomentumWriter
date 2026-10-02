"use client";

import Link from "next/link";
import { copy } from "@/lib/copy";
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
      <Link href="/" role="menuitem" className="ui-button block px-3 py-2">
        {copy.menu.allBooks}
      </Link>
    </ToolbarMenu>
  );
}
