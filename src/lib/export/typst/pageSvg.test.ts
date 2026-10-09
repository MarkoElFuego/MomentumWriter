import { describe, expect, it } from "vitest";
import { pageSvg } from "./pageSvg";

describe("pageSvg", () => {
  it("points the root viewBox at one page and leaves the rest alone", () => {
    const svg = '<svg style="overflow: visible;" class="typst-doc" viewBox="0 0 298.000 1260.000" width="298.000" height="1260.000" data-width="298"><g viewBox="0 0 1 1"/></svg>';
    expect(pageSvg(svg, 419.52755, 297.6378, 419.52755)).toBe(
      '<svg style="overflow: visible;" class="typst-doc" viewBox="0 419.528 297.638 419.528" width="297.638" height="419.528" data-width="298"><g viewBox="0 0 1 1"/></svg>',
    );
  });

  it("refuses an SVG it does not recognize", () => {
    expect(() => pageSvg("<svg></svg>", 0, 1, 1)).toThrow();
  });
});
