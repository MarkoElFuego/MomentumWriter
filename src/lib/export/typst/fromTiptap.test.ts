import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/react";
import { partToTypst } from "./fromTiptap";
import { contentText, runTypst } from "./nodeTypst";

const text = (value: string, ...marks: string[]): JSONContent => ({
  type: "text",
  text: value,
  ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}),
});
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });
const ref = (id: string): JSONContent => ({ type: "footnoteRef", attrs: { id } });
const notes = (...items: [string, JSONContent[]][]): JSONContent => ({
  type: "footnotes",
  content: items.map(([id, content]) => ({ type: "footnote", attrs: { id }, content })),
});

// The template functions the body calls, as simply as possible.
const STUB = `#let centered(body) = body
#let blockquote(body) = body
#let subheading(level, body) = body
#let scenebreak() = [SCENA]
`;

describe("partToTypst", () => {
  it("writes paragraphs separated by a blank line and skips empty ones", () => {
    expect(partToTypst(doc(p(text("Prvi.")), { type: "paragraph" }, p(text("  ")), p(text("Drugi."))))).toBe(
      "Prvi\\.\n\nDrugi\\.",
    );
  });

  it("wraps italic and bold, joining neighboring texts with the same emphasis", () => {
    expect(
      partToTypst(doc(p(text("Rekla je "), text("tiho ", "italic"), text("i", "italic", "laterNote"), text(" "), text("jasno", "bold", "italic")))),
    ).toBe("Rekla je #emph[tiho i]; #strong[#emph[jasno];];");
  });

  it("keeps the author's center; left and justify are the template's", () => {
    const body = partToTypst(
      doc(
        { type: "paragraph", attrs: { textAlign: "center" }, content: [text("Sredina")] },
        { type: "paragraph", attrs: { textAlign: "justify" }, content: [text("Obostrano")] },
        { type: "paragraph", attrs: { textAlign: "left" }, content: [text("Levo")] },
      ),
    );
    expect(body).toBe("#centered[Sredina];\n\nObostrano\n\nLevo");
  });

  it("writes headings, quotes, scene breaks, line breaks and lists", () => {
    const body = partToTypst(
      doc(
        { type: "heading", attrs: { level: 1 }, content: [text("Naslov")] },
        { type: "heading", attrs: { level: 2 }, content: [text("Podnaslov")] },
        { type: "blockquote", content: [p(text("Citat.")), p(text("Drugi red."))] },
        { type: "sceneBreak" },
        p(text("Red"), { type: "hardBreak" }, text("drugi")),
        { type: "bulletList", content: [{ type: "listItem", content: [p(text("a"))] }, { type: "listItem", content: [p(text("b"))] }] },
        { type: "orderedList", content: [{ type: "listItem", content: [p(text("prvi"))] }] },
      ),
    );
    expect(body).toBe(
      [
        "#subheading(1)[Naslov];",
        "#subheading(2)[Podnaslov];",
        "#blockquote[Citat\\.\n\nDrugi red\\.];",
        "#scenebreak();",
        "Red#linebreak();drugi",
        "#list([a], [b]);",
        "#enum([prvi]);",
      ].join("\n\n"),
    );
  });

  it("drops strike, underline and empty headings", () => {
    expect(partToTypst(doc(p(text("reč", "strike", "underline")), { type: "heading", attrs: { level: 1 } }))).toBe("reč");
  });

  it("puts a footnote's text where its number is, mid-sentence, and leaves the zone out", () => {
    const body = partToTypst(
      doc(
        p(text("Stao je"), ref("a"), text(" kod "), text("mosta", "italic"), ref("b"), text(", pa krenuo.")),
        notes(["a", [text("Prva.")]], ["b", [text("Druga, sa "), text("kurzivom", "italic"), text(".")]]),
      ),
    );
    expect(body).toBe(
      "Stao je#footnote[Prva\\.]; kod #emph[mosta];#footnote[Druga, sa #emph[kurzivom];\\.];, pa krenuo\\.",
    );
  });

  it("escapes everything the author wrote", () => {
    expect(partToTypst(doc(p(text("# naslov? *ne* $5 @ana 1. maj"))))).toBe("\\# naslov? \\*ne\\* \\$5 \\@ana 1\\. maj");
  });

  it("compiles in Typst and keeps the text, emphasis and footnotes", async () => {
    const body = partToTypst(
      doc(
        p(text("- Gde si"), ref("a"), text("? "), text("(tiho)", "italic"), text("[1] #2 "), text("$", "bold"), text(".Kraj")),
        { type: "heading", attrs: { level: 1 }, content: [text("= Deo")] },
        { type: "blockquote", content: [p(text("// citat"))] },
        { type: "sceneBreak" },
        { type: "paragraph", attrs: { textAlign: "center" }, content: [text("1. kraj")] },
        notes(["a", [text("Napomena "), text("o", "italic"), text(" #svemu")]]),
      ),
    );
    const run = await runTypst(`${STUB}#metadata[${body}] <t>`, "<t>", "value");
    expect(run.errors).toEqual([]);
    expect(contentText(run.query)).toBe(
      "- Gde siNapomena o #svemu? (tiho)[1] #2 $.Kraj\n\n= Deo\n\n// citat\n\nSCENA\n\n1. kraj",
    );
    const footnotes = await runTypst(`${STUB}${body}`, "footnote");
    expect(footnotes.query).toHaveLength(1);
  });
});
