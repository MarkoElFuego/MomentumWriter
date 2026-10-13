import type { JSONContent } from "@tiptap/react";
import type { Book, Part, PartKind } from "@/lib/db/schema";

// A book with every kind of block, for the import round trips (export → import)
// and for measuring a long book. Test and script use only.

const t = (text: string, ...marks: string[]): JSONContent => ({
  type: "text",
  text,
  ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}),
});
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

export const TEST_BOOK: Book = { id: "b", title: "Kiša nad gradom", language: "sr-Latn", createdAt: 0, updatedAt: 0, genre: "literarni" };

function part(kind: PartKind, title: string, content: JSONContent, order: number): Part {
  return { id: `p${kind}${order}`, bookId: TEST_BOOK.id, kind, title, order, content, wordCount: 0, createdAt: 0, updatedAt: 0 };
}

const firstChapter = doc(
  p(t("Đorđe je čekao"), { type: "footnoteRef", attrs: { id: "a" } }, t(" na stanici. "), t("Tiho", "italic"), t(", "), t("jasno", "bold"), t(".")),
  { type: "heading", attrs: { level: 1 }, content: [t("Jutro")] },
  p(t("Voz je kasnio. Niko nije znao zašto, a "), t("niko nije ni pitao", "italic"), t(".")),
  { type: "heading", attrs: { level: 2 }, content: [t("Peron")] },
  { type: "blockquote", content: [p(t("Ko čeka, dočeka."))] },
  { type: "sceneBreak" },
  { type: "paragraph", attrs: { textAlign: "center" }, content: [t("Tri dana kasnije")] },
  p(t("— Gde si bio? — upitala je Mara.")),
  { type: "footnotes", content: [{ type: "footnote", attrs: { id: "a" }, content: [t("Stanica u "), t("Lapovu", "italic"), t(".")] }] },
);

/** Front matter, three chapters (one without a name), back matter. */
export function testParts(): Part[] {
  return [
    part("front", "Posveta", doc(p(t("Mami, koja je čekala.", "italic"))), 1),
    part("front", "Predgovor", doc(p(t("Ova knjiga je nastala u vozu."))), 2),
    part("chapter", "Dolazak", firstChapter, 1),
    part("chapter", "", doc(p(t("Drugo poglavlje počinje kišom"), { type: "footnoteRef", attrs: { id: "b" } }, t(".")), {
      type: "footnotes",
      content: [{ type: "footnote", attrs: { id: "b" }, content: [t("Kiša je padala celu noć.")] }],
    }), 2),
    part("chapter", "Kraj puta", doc(p(t("Mara je otvorila vrata. "), t("Napokon", "bold"), t("."))), 3),
    part("back", "Zahvalnica", doc(p(t("Hvala svima koji su čitali."))), 1),
  ];
}

const SENTENCES = [
  "Petar je zastao ispred vrata i dugo gledao u bravu.",
  "Kiša je padala celu noć, a grad je spavao ispod nje.",
  "Niko nije znao gde je Mara otišla posle večere.",
  "U kuhinji je mirisalo na kafu i stare novine.",
  "Voz je kasnio, kao i uvek kad je nekome bilo stalo.",
];

/** About `words` words in `chapters` chapters, a footnote and a scene break in each. */
export function longParts(words = 80_000, chapters = 30): Part[] {
  const perChapter = Math.round(words / chapters);
  return Array.from({ length: chapters }, (_, c) => {
    const blocks: JSONContent[] = [];
    let count = 0;
    let n = 0;
    while (count < perChapter) {
      const sentences = Array.from({ length: 6 }, (_, i) => SENTENCES[(n + i + c) % SENTENCES.length]!).join(" ");
      blocks.push(n === 3 ? p(t(sentences.slice(0, 40)), t(sentences.slice(40), "italic")) : p(t(sentences)));
      if (n === 5) blocks.push({ type: "sceneBreak" });
      count += sentences.split(" ").length;
      n++;
    }
    blocks[0] = p(t("Prvi pasus poglavlja"), { type: "footnoteRef", attrs: { id: `n${c}` } }, t(" počinje ovde."));
    const notes = { type: "footnotes", content: [{ type: "footnote", attrs: { id: `n${c}` }, content: [t(`Beleška ${c + 1}.`)] }] };
    return part("chapter", c % 3 === 0 ? "" : `Naslov ${c + 1}`, doc(...blocks, notes), c + 1);
  });
}
