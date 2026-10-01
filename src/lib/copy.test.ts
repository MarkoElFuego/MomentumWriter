import { describe, expect, it } from "vitest";
import { copy } from "./copy";

describe("copy", () => {
  it("has the editor placeholder", () => {
    expect(copy.editor.placeholder).toBe("Počni ovde…");
  });
});

describe("copy.resume.stoppedAt", () => {
  it("says today, yesterday, or N days with the right plural", () => {
    expect(copy.resume.stoppedAt(0)).toBe("Ovde je priča stala ranije danas:");
    expect(copy.resume.stoppedAt(1)).toBe("Ovde je priča stala juče:");
    expect(copy.resume.stoppedAt(2)).toBe("Ovde je priča stala pre 2 dana:");
    expect(copy.resume.stoppedAt(5)).toBe("Ovde je priča stala pre 5 dana:");
    expect(copy.resume.stoppedAt(11)).toBe("Ovde je priča stala pre 11 dana:");
    expect(copy.resume.stoppedAt(21)).toBe("Ovde je priča stala pre 21 dan:");
    expect(copy.resume.stoppedAt(22)).toBe("Ovde je priča stala pre 22 dana:");
  });
});
