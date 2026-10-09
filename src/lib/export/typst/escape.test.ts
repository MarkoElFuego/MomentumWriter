import { describe, expect, it } from "vitest";
import { escapeMarkup, typstString } from "./escape";
import { contentText, runTypst } from "./nodeTypst";

// Text that would turn into code, math, a list, a heading, a comment, a label,
// a link, a dash or smart quotes if it reached Typst unescaped.
const DANGEROUS = [
  "# * _ ` $ @ < > [ ] ~ = + - / \" ' \\ . ; { } ( ) % & | ! ? : , ^",
  "- Gde si? — pita ona.",
  "= Naslov koji to nije",
  "+ jedan + dva",
  "/ termin: opis",
  "1. maj 2026. i 2) april",
  "// ovo nije komentar",
  "/* ni ovo */ kraj",
  "-- i --- i ... i -? i a-b",
  "$x^2 + y_1$ i 5$",
  "@ref i <oznaka> i mail@primer.rs",
  "https://primer.rs/a_b?c=d#e",
  "'jednostruki' \"dvostruki\" „naši” ‘ovi’ i O'Brajen",
  "\\u{1F600} i C:\\Users\\Ana\\",
  "#let x = 1; #set text(red) #{1 + 1}",
  "*ne bold* _ne kurziv_ `ne kod`",
  "100\u00A0km i tab\tovde",
  "Đorđe, Čačak, ćup, šešir, žaba — ĐČĆŠŽ",
];

describe("escapeMarkup", () => {
  it("puts a backslash in front of every special character", () => {
    expect(escapeMarkup("a#b *c* 1. [d]")).toBe("a\\#b \\*c\\* 1\\. \\[d\\]");
  });

  it("turns line breaks and tabs into spaces", () => {
    expect(escapeMarkup("a\nb\r\nc\td")).toBe("a b c d");
  });

  it.each(DANGEROUS)("Typst prints exactly the same text: %s", async (text) => {
    const run = await runTypst(`#metadata([${escapeMarkup(text)}]) <t>`, "<t>", "value");
    expect(run.errors).toEqual([]);
    // Typst collapses runs of spaces like any typesetter; everything else must match.
    expect(contentText(run.query)).toBe(text.replace(/[ \t]+/g, " "));
  });
});

describe("typstString", () => {
  it("quotes and escapes for a Typst string literal", () => {
    expect(typstString('Ana "Kiša" \\ x')).toBe('"Ana \\"Kiša\\" \\\\ x"');
  });

  it("survives Typst unchanged", async () => {
    const text = 'Naslov "u navodnicima" \\ #kraj $';
    const run = await runTypst(`#metadata(${typstString(text)}) <t>`, "<t>", "value");
    expect(run.errors).toEqual([]);
    expect(run.query).toEqual([text]);
  });
});
