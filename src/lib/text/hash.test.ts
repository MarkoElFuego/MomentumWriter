import { describe, expect, it } from "vitest";
import { hashText } from "./hash";

describe("hashText", () => {
  it("is stable and 8 hex characters long", () => {
    expect(hashText("Petar je zastao.")).toBe(hashText("Petar je zastao."));
    expect(hashText("Petar je zastao.")).toMatch(/^[0-9a-f]{8}$/);
  });

  it("changes when the text changes", () => {
    expect(hashText("Petar je zastao.")).not.toBe(hashText("Petar je zastao!"));
    expect(hashText("")).not.toBe(hashText(" "));
  });
});
