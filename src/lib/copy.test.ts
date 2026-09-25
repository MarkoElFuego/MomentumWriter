import { describe, expect, it } from "vitest";
import { copy } from "./copy";

describe("copy", () => {
  it("has the editor placeholder", () => {
    expect(copy.editor.placeholder).toBe("Počni ovde…");
  });
});
