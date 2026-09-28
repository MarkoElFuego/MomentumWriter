import { describe, expect, it } from "vitest";
import { lastSentence } from "./lastSentence";

describe("lastSentence", () => {
  it("returns an empty string when there is no text", () => {
    expect(lastSentence("")).toBe("");
    expect(lastSentence("  \n\n — ")).toBe("");
  });

  it("returns the last of several sentences", () => {
    expect(lastSentence("Kiša je stala. Petar je izašao. Ana je ostala.")).toBe("Ana je ostala.");
  });

  it("keeps an unfinished sentence where the cursor stopped", () => {
    expect(lastSentence("Kiša je stala. Petar je otvorio vrata i")).toBe("Petar je otvorio vrata i");
  });

  it("looks only at the last paragraph, skipping trailing empty ones", () => {
    expect(lastSentence("POGLAVLJE PRVO\n\nPetar je čekao.\n\n")).toBe("Petar je čekao.");
    expect(lastSentence("Petar je čekao.\n\nPOGLAVLJE DRUGO")).toBe("POGLAVLJE DRUGO");
  });

  it("keeps closing quotes with their sentence", () => {
    expect(lastSentence("Rekla je: „Idi.” Otišao je bez reči.")).toBe("Otišao je bez reči.");
  });

  it("keeps the end of a long sentence behind an ellipsis", () => {
    const long = `${"i onda je hodao dalje ".repeat(12)}do same reke.`;
    const result = lastSentence(long);
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result.startsWith("…")).toBe(true);
    expect(result.endsWith("do same reke.")).toBe(true);
    // Cut on a word boundary: the kept tail follows a space in the original.
    const tail = result.slice(1);
    expect(long.endsWith(tail)).toBe(true);
    expect(long[long.length - tail.length - 1]).toBe(" ");
  });

  it("works with Cyrillic", () => {
    expect(lastSentence("Киша је стала. Петар је изашао.")).toBe("Петар је изашао.");
  });
});
