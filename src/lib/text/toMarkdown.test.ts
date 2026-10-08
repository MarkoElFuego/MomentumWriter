import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/react";
import { exportFileName, partToMarkdown } from "./toMarkdown";

const text = (value: string, ...marks: string[]): JSONContent => ({
  type: "text",
  text: value,
  ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}),
});
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

describe("partToMarkdown", () => {
  it("separates paragraphs with a blank line and skips empty ones", () => {
    const { body } = partToMarkdown(doc(p(text("Prvi.")), { type: "paragraph" }, p(text("Drugi."))));
    expect(body).toBe("Prvi.\n\nDrugi.");
  });

  it("wraps bold and italic, keeping spaces outside the markers", () => {
    const { body } = partToMarkdown(
      doc(p(text("Rekla je "), text("tiho ", "italic"), text("i "), text("jasno", "bold", "italic"), text(".")))
    );
    expect(body).toBe("Rekla je *tiho* i ***jasno***.");
  });

  it("joins neighboring texts with the same emphasis (a later note splits the text)", () => {
    const { body } = partToMarkdown(doc(p(text("jedna ", "italic"), text("reč", "italic", "laterNote"))));
    expect(body).toBe("*jedna reč*");
  });

  it("escapes characters that Markdown would read as formatting", () => {
    const { body } = partToMarkdown(doc(p(text("- Gde si? *pita* [x] a_b")), p(text("1. maj"))));
    expect(body).toBe("\\- Gde si? \\*pita\\* \\[x\\] a\\_b\n\n1\\. maj");
  });

  it("writes headings, quotes, scene breaks and line breaks", () => {
    const { body } = partToMarkdown(
      doc(
        { type: "heading", attrs: { level: 1 }, content: [text("Naslov")] },
        { type: "heading", attrs: { level: 2 }, content: [text("Podnaslov")] },
        { type: "blockquote", content: [p(text("Citat.")), p(text("Još."))] },
        { type: "sceneBreak" },
        p(text("Red"), { type: "hardBreak" }, text("- drugi")),
      ),
    );
    expect(body).toBe("### Naslov\n\n#### Podnaslov\n\n> Citat.\n>\n> Još.\n\n* * *\n\nRed\\\n\\- drugi");
  });

  it("keeps the text of pasted lists", () => {
    const item = (value: string) => ({ type: "listItem", content: [p(text(value))] });
    const { body } = partToMarkdown(doc({ type: "bulletList", content: [item("jedan"), item("dva")] }));
    expect(body).toBe("- jedan\n- dva");
  });

  it("numbers footnotes in reference order from the given number", () => {
    const ref = (id: string) => ({ type: "footnoteRef", attrs: { id } });
    const note = (id: string, value: string) => ({ type: "footnote", attrs: { id }, content: [text(value)] });
    const result = partToMarkdown(
      doc(p(text("Prvo"), ref("a"), text(" i drugo"), ref("b"), text(".")), {
        type: "footnotes",
        content: [note("a", "Prva fusnota."), note("b", "Druga, u *kurzivu*.")],
      }),
      3,
    );
    expect(result.body).toBe("Prvo[^3] i drugo[^4].");
    expect(result.notes).toEqual(["Prva fusnota.", "Druga, u \\*kurzivu\\*."]);
  });

  it("returns nothing for an empty part", () => {
    expect(partToMarkdown(doc({ type: "paragraph" }))).toEqual({ body: "", notes: [] });
  });
});

describe("exportFileName", () => {
  it("keeps the title with letters and adds the day", () => {
    expect(exportFileName("Kiša: čovek/žena?", new Date(2026, 9, 7))).toBe("Kiša čovekžena 2026-10-07.md");
  });

  it("falls back when nothing is left of the title", () => {
    expect(exportFileName(" ?? ", new Date(2026, 0, 2))).toBe("knjiga 2026-01-02.md");
  });
});
