import { describe, expect, it } from "vitest";
import { panelShortcut } from "./panelShortcut";

const key = (init: Partial<KeyboardEvent> & { altGraph?: boolean }) => ({
  key: "",
  code: "",
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...init,
  getModifierState: (name: string) => name === "AltGraph" && !!init.altGraph,
});

describe("panelShortcut", () => {
  it("opens the contents with Ctrl/Cmd+\ and Tiron with Shift", () => {
    expect(panelShortcut(key({ ctrlKey: true, key: "\\", code: "Backslash" }))).toBe("structure");
    expect(panelShortcut(key({ metaKey: true, key: "\\", code: "Backslash" }))).toBe("structure");
    expect(panelShortcut(key({ ctrlKey: true, shiftKey: true, key: "|", code: "Backslash" }))).toBe("tiron");
  });

  it("works on the Serbian layout, where that key types „ž”", () => {
    expect(panelShortcut(key({ ctrlKey: true, key: "ž", code: "Backslash" }))).toBe("structure");
    expect(panelShortcut(key({ ctrlKey: true, shiftKey: true, key: "Ž", code: "Backslash" }))).toBe("tiron");
  });

  it("lets AltGr type \ and | in the text (Windows reports AltGr as Ctrl+Alt)", () => {
    expect(panelShortcut(key({ ctrlKey: true, altKey: true, key: "\\", code: "KeyQ" }))).toBeNull();
    expect(panelShortcut(key({ ctrlKey: true, altKey: true, key: "|", code: "KeyW" }))).toBeNull();
    expect(panelShortcut(key({ key: "\\", code: "KeyQ", altGraph: true }))).toBeNull();
  });

  it("ignores other keys and the bare key", () => {
    expect(panelShortcut(key({ key: "\\", code: "Backslash" }))).toBeNull();
    expect(panelShortcut(key({ ctrlKey: true, key: "b", code: "KeyB" }))).toBeNull();
  });
});
