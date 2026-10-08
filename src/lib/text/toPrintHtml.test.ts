import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/react";
import { hasPrintableText, partToPrintHtml } from "./toPrintHtml";

const text = (value: string, ...marks: string[]): JSONContent => ({
  type: "text",
  text: value,
  ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}),
});
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });
const BREAK = "✱ ✱ ✱";

describe("partToPrintHtml", () => {
  it("writes paragraphs and skips empty ones", () => {
    const { body } = partToPrintHtml(doc(p(text("Prvi.")), { type: "paragraph" }, p(text("Drugi."))), BREAK);
    expect(body).toBe("<p>Prvi.</p><p>Drugi.</p>");
  });

  it("keeps bold, italic and the author's alignment; drops strike and later notes", () => {
    const { body } = partToPrintHtml(
      doc(
        { type: "paragraph", attrs: { textAlign: "center" }, content: [text("tiho", "italic"), text(" i "), text("jasno", "bold")] },
        { type: "paragraph", attrs: { textAlign: "left" }, content: [text("reč", "strike", "laterNote")] },
      ),
      BREAK,
    );
    expect(body).toBe('<p class="align-center"><em>tiho</em> i <strong>jasno</strong></p><p>reč</p>');
  });

  it("escapes HTML in the text", () => {
    const { body } = partToPrintHtml(doc(p(text('<b>"a" & b</b>'))), BREAK);
    expect(body).toBe("<p>&lt;b&gt;&quot;a&quot; &amp; b&lt;/b&gt;</p>");
  });

  it("writes headings, quotes, scene breaks and line breaks", () => {
    const { body } = partToPrintHtml(
      doc(
        { type: "heading", attrs: { level: 1 }, content: [text("Naslov")] },
        { type: "heading", attrs: { level: 2 }, content: [text("Podnaslov")] },
        { type: "blockquote", content: [p(text("Citat."))] },
        { type: "sceneBreak" },
        p(text("Red"), { type: "hardBreak" }, text("drugi")),
      ),
      BREAK,
    );
    expect(body).toBe(
      "<h3>Naslov</h3><h4>Podnaslov</h4><blockquote><p>Citat.</p></blockquote>" +
        '<p class="scene-break" aria-label="prelom scene">✱ ✱ ✱</p><p>Red<br>drugi</p>',
    );
  });

  it("numbers footnotes from firstNote and leaves the zone out of the body", () => {
    const { body, notes } = partToPrintHtml(
      doc(
        p(text("Tekst"), { type: "footnoteRef", attrs: { id: "a" } }, text(" i"), { type: "footnoteRef", attrs: { id: "b" } }),
        {
          type: "footnotes",
          content: [
            { type: "footnote", attrs: { id: "a" }, content: [text("Prva", "italic")] },
            { type: "footnote", attrs: { id: "b" }, content: [text("Druga")] },
          ],
        },
      ),
      BREAK,
      3,
    );
    expect(body).toBe(
      '<p>Tekst<sup class="note-ref"><a href="#fn-3" id="fnref-3">3</a></sup> i' +
        '<sup class="note-ref"><a href="#fn-4" id="fnref-4">4</a></sup></p>',
    );
    expect(notes).toEqual(["<em>Prva</em>", "Druga"]);
  });
});

describe("hasPrintableText", () => {
  it("is false for an empty document or only whitespace", () => {
    expect(hasPrintableText(doc({ type: "paragraph" }))).toBe(false);
    expect(hasPrintableText(doc(p(text("   "))))).toBe(false);
  });

  it("is true for text or a scene break, but not for footnotes alone", () => {
    expect(hasPrintableText(doc(p(text("Mami."))))).toBe(true);
    expect(hasPrintableText(doc({ type: "sceneBreak" }))).toBe(true);
    expect(
      hasPrintableText(doc({ type: "paragraph" }, { type: "footnotes", content: [{ type: "footnote", content: [text("x")] }] })),
    ).toBe(false);
  });
});
