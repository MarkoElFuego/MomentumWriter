// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/react";
import { docFromJSON } from "@/components/editor/contentSchema";
import { htmlToBlocks } from "./fromHtml";
import { splitBook } from "./splitBook";
import { auditWords, importedText } from "./wordAudit";

/** HTML → book, checked like every import: valid documents, no lost words. */
function importHtml(html: string) {
  const result = htmlToBlocks(html);
  const split = splitBook(result.blocks, result.notes);
  for (const part of split.parts) docFromJSON(part.content, "sr-Latn").check();
  expect(auditWords(result.sourceText, importedText(split.parts, split.titlePage), [...split.dropped, ...result.dropped])).toEqual({
    missing: [],
    added: [],
  });
  return { ...result, split };
}

const zone = (content: JSONContent) => content.content?.find((block) => block.type === "footnotes");
const refs = (blocks: JSONContent[]) => JSON.stringify(blocks).match(/"footnoteRef"/g)?.length ?? 0;

describe("htmlToBlocks — formatting", () => {
  it("italic, bold (tags and Google Docs styles), headings, quote, centered line", () => {
    const { blocks } = importHtml(`
      <b style="font-weight:normal" id="docs-internal-guid-1">
        <h1>Kofer</h1>
        <p>Obično <i>kurziv</i> <strong>bold</strong> <span style="font-style:italic">stil kurziv</span> <span style="font-weight:700">stil bold</span>.</p>
        <h3>Jutro</h3>
        <blockquote><p>Citat.</p></blockquote>
        <p style="text-align:center">Centrirano</p>
        <p style="text-align:justify">Obostrano.</p>
      </b>`);
    expect(blocks[0]).toMatchObject({ type: "heading", attrs: { level: 1 }, content: [{ text: "Kofer" }] });
    const marks = (blocks[1]!.content ?? []).filter((node) => node.marks).map((node) => [node.text, node.marks![0]!.type]);
    expect(marks).toEqual([
      ["kurziv", "italic"],
      ["bold", "bold"],
      ["stil kurziv", "italic"],
      ["stil bold", "bold"],
    ]);
    // The Google Docs wrapper <b style="font-weight:normal"> is not bold.
    expect(blocks[1]!.content?.[0]).toEqual({ type: "text", text: "Obično " });
    // The source level is kept for splitBook; it fits the levels to the editor later.
    expect(blocks[2]).toMatchObject({ type: "heading", attrs: { level: 3 } });
    expect(blocks[3]).toMatchObject({ type: "blockquote" });
    expect(blocks[4]!.attrs?.textAlign).toBe("center");
    // Justified comes from the page setup — the editor's default instead.
    expect(blocks[5]!.attrs?.textAlign).toBe("left");
  });

  it("images are left out and counted; tables become paragraphs", () => {
    const { blocks, warnings } = importHtml(`
      <p>Pre slike.<img src="x.png" alt="slika"></p>
      <table><tr><td>Ćelija jedan</td><td><p>Ćelija dva</p></td></tr></table>
      <p>Posle.</p>`);
    expect(warnings).toEqual({ images: 1, tables: 1, plainFootnotes: 0 });
    expect(blocks.map((block) => block.content?.[0]?.text)).toEqual(["Pre slike.", "Ćelija jedan", "Ćelija dva", "Posle."]);
  });
});

describe("htmlToBlocks — footnotes", () => {
  it("DOCX converter (mammoth): footnote mid-sentence and one with italic", () => {
    const { blocks, notes, split } = importHtml(`
      <h1>Poglavlje 1</h1>
      <p>Usred<sup><a href="#footnote-1" id="footnote-ref-1">[1]</a></sup> rečenice.</p>
      <h1>Poglavlje 2</h1>
      <p>Kraj.<sup><a href="#footnote-2" id="footnote-ref-2">[2]</a></sup></p>
      <ol>
        <li id="footnote-1"><p>Prva beleška. <a href="#footnote-ref-1">↑</a></p></li>
        <li id="footnote-2"><p>Druga, <em>u kurzivu</em>. <a href="#footnote-ref-2">↑</a></p></li>
      </ol>`);
    expect(refs(blocks)).toBe(2);
    expect([...notes.values()]).toEqual([
      [{ type: "text", text: "Prva beleška." }],
      [
        { type: "text", text: "Druga, " },
        { type: "text", text: "u kurzivu", marks: [{ type: "italic" }] },
        { type: "text", text: "." },
      ],
    ]);
    expect(split.parts[0]!.content.content?.[0]?.content).toEqual([
      { type: "text", text: "Usred" },
      { type: "footnoteRef", attrs: { id: [...notes.keys()][0] } },
      { type: "text", text: " rečenice." },
    ]);
    // Each note in its own part; the list at the end is gone.
    expect(zone(split.parts[0]!.content)?.content).toHaveLength(1);
    expect(zone(split.parts[1]!.content)?.content).toHaveLength(1);
    expect(split.parts[1]!.content.content?.filter((block) => block.type !== "footnotes")).toHaveLength(1);
  });

  it("Google Docs: back link at the start of the note", () => {
    const { notes, blocks } = importHtml(`
      <p><span>Tekst</span><sup><a href="#ftnt1" id="ftnt_ref1">[1]</a></sup><span> dalje.</span></p>
      <hr>
      <div><p><a href="#ftnt_ref1" id="ftnt1">[1]</a><span>&nbsp;Beleška iz Google Docs-a.</span></p></div>`);
    expect(refs(blocks)).toBe(1);
    expect([...notes.values()]).toEqual([[{ type: "text", text: "Beleška iz Google Docs-a." }]]);
    expect(blocks).toHaveLength(1);
  });

  it("Word paste: named anchors", () => {
    const { notes, blocks } = importHtml(`
      <p class="MsoNormal">Reč<a href="#_ftn1" name="_ftnref1"><span class="MsoFootnoteReference">[1]</span></a> i dalje.</p>
      <div><div id="ftn1"><p class="MsoFootnoteText"><a href="#_ftnref1" name="_ftn1"><span class="MsoFootnoteReference">[1]</span></a> Wordova beleška.</p></div></div>`);
    expect(refs(blocks)).toBe(1);
    expect([...notes.values()]).toEqual([[{ type: "text", text: "Wordova beleška." }]]);
    expect(blocks).toHaveLength(1);
  });

  it("a number whose note can't be found stays as text", () => {
    const { notes, blocks, warnings } = importHtml(`<p>Tekst<sup><a href="#nema">[1]</a></sup> dalje.</p><p>[1] Beleška bez veze.</p>`);
    expect(notes.size).toBe(0);
    expect(warnings.plainFootnotes).toBe(1);
    expect(JSON.stringify(blocks)).toContain("[1]");
    expect(JSON.stringify(blocks)).toContain("Beleška bez veze.");
  });

  it("table-of-contents links are not footnotes", () => {
    const { notes } = importHtml(`<p><a href="#_Toc1">1</a></p><h1 id="_Toc1">Poglavlje 1</h1><p>A.</p><h1>Poglavlje 2</h1><p>B.</p>`);
    expect(notes.size).toBe(0);
  });
});
