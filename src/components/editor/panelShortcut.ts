// Ctrl/Cmd+\ — the contents on the left; with Shift, Tiron on the right.

type ShortcutEvent = Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "getModifierState">;

export function panelShortcut(event: ShortcutEvent & { shiftKey: boolean }): "structure" | "tiron" | null {
  if (!(event.ctrlKey || event.metaKey)) return null;
  // Windows reports AltGr as Ctrl+Alt, and the Serbian layout types "\" and "|" with
  // AltGr (Q, W): that is a character for the text, not the shortcut.
  if (event.altKey || event.getModifierState("AltGraph")) return null;
  // event.code keeps the shortcut on the key where English has "\" (Serbian: "ž").
  if (event.key !== "\\" && event.key !== "|" && event.code !== "Backslash") return null;
  return event.shiftKey ? "tiron" : "structure";
}
