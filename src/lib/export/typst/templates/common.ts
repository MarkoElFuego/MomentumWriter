import { copy } from "@/lib/copy";
import type { Language } from "@/lib/languages";
import type { ExportSection } from "../buildBook";
import { escapeMarkup } from "../escape";

/**
 * Hyphenation language. Typst has Serbian rules only for Cyrillic; the Croatian
 * ones are the same for Latin script. A future sr-Cyrl maps to "sr".
 */
export function typstLang(language: Language): string {
  return language === "sr-Latn" ? "hr" : "sr";
}

/** Plain text with line breaks → Typst content, one line per line. */
export function lines(text: string): string {
  return text
    .split(/\r\n?|\n/)
    .map((line) => escapeMarkup(line.trim()))
    .filter(Boolean)
    .join(" #linebreak(); ");
}

/** "Poglavlje IV" for a chapter, nothing for front and back matter. */
export function sectionLabel(section: ExportSection): string | undefined {
  return section.number ? copy.structure.chapterHeading(section.number, "") : undefined;
}

/** A content argument, or `none` when there is nothing to show. */
export function contentArg(text: string | undefined): string {
  return text ? `[${escapeMarkup(text)}]` : "none";
}

/** The author's surname for the manuscript header: the last word of the name. */
export function surname(author: string | undefined): string {
  return author?.trim().split(/\s+/).pop() ?? "";
}
