import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { coveredCodePoints, missingCharacters } from "./fontCoverage";
import { FONT_PATHS } from "./nodeTypst";

describe("coveredCodePoints", () => {
  it.each(FONT_PATHS)("%s draws Serbian letters and book typography", (path) => {
    const covered = coveredCodePoints(new Uint8Array(readFileSync(path)));
    expect(missingCharacters("ČĆŠŽĐčćšžđ „navodnici” ‘jedan’ — – … * § † ° € Жж 0123456789", covered)).toEqual([]);
  });

  it("has no ✱ — the scene break is drawn in the template instead", () => {
    const covered = coveredCodePoints(new Uint8Array(readFileSync(FONT_PATHS[0]!)));
    expect(missingCharacters("✱ ✱ ✱ i ❧ i ✱", covered)).toEqual(["✱", "❧"]);
  });
});
