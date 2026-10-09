import { describe, expect, it } from "vitest";
import { pageSvg } from "./pageSvg";

describe("pageSvg", () => {
  it("points the root viewBox at one page and leaves the rest alone", () => {
    const svg = '<svg style="overflow: visible;" class="typst-doc" viewBox="0 0 298.000 1260.000" width="298.000" height="1260.000" data-width="298"><g viewBox="0 0 1 1"/></svg>';
    expect(pageSvg(svg, 419.52755, 297.6378, 419.52755)).toBe(
      '<svg style="overflow: visible;" class="typst-doc" viewBox="0 419.528 297.638 419.528" width="297.638" height="419.528" data-width="298"><g viewBox="0 0 1 1"/></svg>',
    );
  });

  it("drops the text layer for mouse selection, which would show as a second copy", () => {
    const svg =
      '<svg class="typst-doc" viewBox="0 0 1 2" width="1" height="2"><g><use href="#g1"/><g transform="scale(16,-16)"><foreignObject x="0" y="-73.56" width="1923.51" height="62.50"><h5:div class="tsel" style="font-size: 62px">Kiša </h5:div></foreignObject></g></g><foreignObject x="1"><h5:div class="tsel">i opet</h5:div></foreignObject></svg>';
    const page = pageSvg(svg, 0, 1, 1);
    expect(page).not.toContain("foreignObject");
    expect(page).not.toContain("Kiša");
    expect(page).toContain('<use href="#g1"/>');
  });

  it("refuses an SVG it does not recognize", () => {
    expect(() => pageSvg("<svg></svg>", 0, 1, 1)).toThrow();
  });
});
