import { Extension } from "@tiptap/react";

// StarterKit brings shortcuts the editor does not offer (Faza 5, author's decision
// 2026-10-09): underline and strike never reach an export and „Sredi tekst” removes
// them, and the text is prose — lists only stay when pasted. The marks and nodes stay
// in the schema, so saved and pasted text still opens; only the keys do nothing.
// Ctrl+Shift+B (quote) stays: it does what the „Citat” style does.
export const HIDDEN_SHORTCUTS = ["Mod-u", "Mod-U", "Mod-Shift-s", "Mod-Shift-S", "Mod-Shift-7", "Mod-Shift-8"] as const;

export const NoHiddenShortcuts = Extension.create({
  name: "noHiddenShortcuts",
  // Before StarterKit's own keymaps (default priority 100).
  priority: 1000,
  addKeyboardShortcuts() {
    return Object.fromEntries(HIDDEN_SHORTCUTS.map((key) => [key, () => true]));
  },
});
