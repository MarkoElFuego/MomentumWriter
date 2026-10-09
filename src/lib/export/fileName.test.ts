import { describe, expect, it } from "vitest";
import { kdpFileName, pdfFileName } from "./fileName";

describe("pdfFileName", () => {
  it("joins the words with hyphens and keeps Serbian letters", () => {
    expect(pdfFileName("Kiša nad  stanicom")).toBe("Kiša-nad-stanicom.pdf");
  });

  it("drops characters the file system refuses", () => {
    expect(pdfFileName('Ko je "ubio"? Da/Ne: <1>.')).toBe("Ko-je-ubio-Da-Ne-1.pdf");
    expect(pdfFileName(" ?*: ")).toBe("Nova-knjiga.pdf");
  });

  it("names the manuscript after the author's surname", () => {
    expect(pdfFileName("Kiša", { author: "Ana Petrović" })).toBe("Petrović-Kiša-rukopis.pdf");
    expect(pdfFileName("Kiša", {})).toBe("Kiša-rukopis.pdf");
  });
});

describe("kdpFileName", () => {
  it("names the KDP file after the book and the trim size", () => {
    expect(kdpFileName("Kiša nad stanicom", "6x9")).toBe("Kiša-nad-stanicom-KDP-6x9.pdf");
    expect(kdpFileName("", "5.25x8")).toBe("Nova-knjiga-KDP-5.25x8.pdf");
  });
});
