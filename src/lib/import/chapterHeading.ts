import { countWords } from "@/lib/text/countWords";
import { hasCyrillic, toLatin } from "./cyrillic";

// Uvoz (ZADATAK_UVOZ I1): is a short block the heading of a part, and what
// stays as its name? The number goes — Momentum counts chapters itself — the
// name stays. Rules only, no AI; the author confirms in the preview.

export type HeadingRole =
  /** `family` groups headings of one kind ("Poglavlje 3", "III"…) — a family counts only if it repeats. */
  | { role: "chapter"; family: string; title: string }
  | { role: "front" | "back"; title: string }
  /** „Deo prvi” — a level above chapters that Momentum doesn't have. */
  | { role: "bookPart" };

/** A heading is a short line; anything longer is prose. */
export const MAX_HEADING_WORDS = 10;

const FRONT = ["Posveta", "Predgovor", "Prolog", "Uvod"];
const BACK = ["Epilog", "Pogovor", "Zahvalnica", "Zahvalnost", "Beleška o autoru", "O autoru"];

const ORDINAL =
  "(?:prv|drug|treć|trec|četvrt|cetvrt|pet|šest|sest|sedm|osm|devet|deset|jedanaest|dvanaest|trinaest|četrnaest|cetrnaest|petnaest|šesnaest|sesnaest|sedamnaest|osamnaest|devetnaest|dvadeset)(?:i|a|o|e)";
const NUMBER = `(\\d{1,3}|[ivxlcdm]+|${ORDINAL})`;
// Between the number and the name: "3. Kofer", "III · Kofer", "III – Kofer", "Poglavlje 3: Kofer".
// A space after the mark, so "3.5 miliona" stays a number in a sentence.
const NAME = "(?:\\.?$|\\s*[.:·•–—-]\\s+(.+)$)";

const KEYWORD_FIRST = new RegExp(`^(poglavlje|glava|chapter)\\s+${NUMBER}${NAME}`, "iu");
const ORDINAL_FIRST = new RegExp(`^(${ORDINAL})\\s+(poglavlje|glava)${NAME}`, "iu");
const BARE_ARABIC = new RegExp(`^(\\d{1,3})${NAME}`, "u");
// Upper case only: a lone "vi" or "mi" is a word, not a number.
const BARE_ROMAN = new RegExp(`^([IVXLCDM]+)${NAME}`, "u");
const BOOK_PART_FIRST = new RegExp(`^(?:deo|knjiga)\\s+${NUMBER}${NAME}`, "iu");
const BOOK_PART_ORDINAL = new RegExp(`^${ORDINAL}\\s+(?:deo|knjiga)${NAME}`, "iu");

const ROMAN = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/u;
const isRoman = (value: string) => value !== "" && ROMAN.test(value.toUpperCase());
const isNumber = (value: string) => /^\d+$/u.test(value) || isRoman(value) || new RegExp(`^${ORDINAL}$`, "iu").test(value);

// Dialogue never is a heading: a dash or a quotation mark at the start.
const DIALOGUE = /^[-–—"'„“”«»‘’‚]/u;

function namedPart(text: string, names: string[]): string | null {
  for (const name of names) {
    const match = new RegExp(`^${name}(?:\\s*[:.]?$|\\s*[:·•–—-]\\s*(.+)$)`, "iu").exec(text);
    // An exact name takes the usual spelling ("PROLOG" → "Prolog"); one with a subtitle stays as written.
    if (match) return match[1] ? text : name;
  }
  return null;
}

/** One line: a line break inside a heading ("Poglavlje IV⏎Kofer", Word) separates number and name. */
const oneLine = (raw: string) => raw.trim().replace(/\s*\n\s*/gu, " · ").replace(/\s+/gu, " ");

/**
 * The role of a short unstyled block, or null when it's just text. Cyrillic
 * headings are read in Latin; the name is taken back from the original, word
 * for word — transliteration never changes the number of words.
 */
export function headingRole(raw: string, styled = false): HeadingRole | null {
  const text = oneLine(raw);
  if (!hasCyrillic(text)) return latinRole(text, styled);
  const role = latinRole(toLatin(text), styled);
  if (role?.role !== "chapter" || !role.title) return role;
  const words = role.title.split(" ").length;
  return { ...role, title: text.split(" ").slice(-words).join(" ") };
}

function latinRole(text: string, styled: boolean): HeadingRole | null {
  if (!text || countWords(text) > MAX_HEADING_WORDS || DIALOGUE.test(text)) return null;

  const front = namedPart(text, FRONT);
  if (front) return { role: "front", title: front };
  const back = namedPart(text, BACK);
  if (back) return { role: "back", title: back };

  const bookPart = BOOK_PART_FIRST.exec(text);
  if ((bookPart && isNumber(bookPart[1]!)) || BOOK_PART_ORDINAL.test(text)) return { role: "bookPart" };

  const chapter = chapterOf(text);
  if (!chapter) return null;
  // "3 dana kasnije." is a sentence, not a chapter — only the number itself may end in a dot.
  // A styled heading is a heading anyway: "Poglavlje I · Kraj." keeps its name.
  if (!styled && chapter.title && /[.…]$/u.test(chapter.title)) return null;
  return { role: "chapter", ...chapter };
}

function chapterOf(text: string): { family: string; title: string } | null {
  const keyword = KEYWORD_FIRST.exec(text);
  if (keyword && isNumber(keyword[2]!)) return { family: keyword[1]!.toLowerCase(), title: keyword[3]?.trim() ?? "" };
  const ordinal = ORDINAL_FIRST.exec(text);
  if (ordinal) return { family: ordinal[2]!.toLowerCase(), title: ordinal[3]?.trim() ?? "" };
  const arabic = BARE_ARABIC.exec(text);
  if (arabic) return { family: "arabic", title: arabic[2]?.trim() ?? "" };
  const roman = BARE_ROMAN.exec(text);
  if (roman && isRoman(roman[1]!)) return { family: "roman", title: roman[2]?.trim() ?? "" };
  return null;
}

// "***", "* * *", "#", "§", "~", "✱ ✱ ✱", "---"…: a line of marks between scenes.
const SCENE_MARKS = /^(?:[*#§~✱⁂❧•◆◇❖✦✧]\s*){1,5}$|^(?:[-–—_=]\s*){3,}$/u;

export function isSceneBreakText(raw: string): boolean {
  return SCENE_MARKS.test(raw.trim());
}

/**
 * A heading the author styled as one (Heading 1…): trusted even without a
 * number — "Kofer" is a chapter called Kofer. Front/back names and „Deo prvi”
 * keep their meaning.
 */
export function styledHeadingRole(raw: string): HeadingRole {
  const text = oneLine(raw);
  const role = headingRole(text, true);
  if (role?.role === "chapter") return { ...role, family: "styled" };
  return role ?? { role: "chapter", family: "styled", title: text };
}
