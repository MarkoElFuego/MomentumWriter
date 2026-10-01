import { describe, expect, it } from "vitest";
import { docFromJSON, restorablePos } from "./contentSchema";
import { mainTextEnd } from "./footnotes";

const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

// "Petar je zastao." + a footnote ref, then a second paragraph, then the note zone.
const content = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Petar je zastao." }, { type: "footnoteRef", attrs: { id: "n1" } }] },
    paragraph("Vrata su bila zaključana."),
    { type: "footnotes", content: [{ type: "footnote", attrs: { id: "n1" }, content: [{ type: "text", text: "Beleška." }] }] },
  ],
};

describe("restorablePos", () => {
  const doc = docFromJSON(content, "sr-Latn");
  const end = mainTextEnd(doc);
  const lastTextPos = end - 1; // inside the last prose paragraph, after its text

  it("reads saved content with the editor's schema", () => {
    expect(doc.lastChild?.type.name).toBe("footnotes");
    expect(doc.textBetween(0, end, "\n")).toBe("Petar je zastao.\nVrata su bila zaključana.");
  });

  it("keeps a position inside the main text", () => {
    expect(restorablePos(doc, 6)).toBe(6);
  });

  it("moves a position in the footnote zone to the end of the main text", () => {
    expect(restorablePos(doc, doc.content.size - 2)).toBe(lastTextPos);
    expect(restorablePos(doc, 10_000)).toBe(lastTextPos);
  });

  it("treats 0 as unknown and uses the end of the main text", () => {
    expect(restorablePos(doc, 0)).toBe(lastTextPos);
  });

  it("lands inside a text block when the position falls between blocks", () => {
    const between = doc.firstChild!.nodeSize; // after the first paragraph's closing token
    const pos = restorablePos(doc, between);
    expect(doc.resolve(pos).parent.isTextblock).toBe(true);
  });
});
