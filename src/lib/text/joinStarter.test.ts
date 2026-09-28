import { describe, expect, it } from "vitest";
import { joinStarter } from "./joinStarter";

describe("joinStarter", () => {
  it("adds a space after a word and a trailing space", () => {
    expect(joinStarter("o", "kraja godine")).toBe(" kraja godine ");
  });

  it("does not double the space after whitespace", () => {
    expect(joinStarter(" ", "kraja godine")).toBe("kraja godine ");
  });

  it("adds no leading space at the start of a paragraph", () => {
    expect(joinStarter("", "Sledeceg jutra")).toBe("Sledeceg jutra ");
  });

  it("adds a space after sentence punctuation", () => {
    expect(joinStarter(".", "Tada je shvatio")).toBe(" Tada je shvatio ");
  });

  it("stays tight after an opening quote", () => {
    expect(joinStarter("„", "Ne mogu")).toBe("Ne mogu ");
  });

  it("attaches a starter that begins with a comma", () => {
    expect(joinStarter("o", ", a onda")).toBe(", a onda ");
  });

  it("trims whitespace the model left around the starter", () => {
    expect(joinStarter("o", "  kraja godine \n")).toBe(" kraja godine ");
  });
});
