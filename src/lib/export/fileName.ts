import { copy } from "@/lib/copy";
import { surname } from "./typst/templates/common";

// Export file names (ZADATAK_IZVOZ P4): "Kisa-nad-stanicom.pdf" keeps the letters
// as the author wrote them; only what Windows and macOS refuse goes, spaces become "-".

function slug(text: string): string {
  return text
    .replace(/[\/:*?"<>|\u0000-\u001f]/g, " ")
    .trim()
    .replace(/[.\s]+$/, "")
    .replace(/\s+/g, "-");
}

/** "Naslov-knjige.pdf"; the manuscript is "Prezime-Naslov-rukopis.pdf". */
export function pdfFileName(title: string, manuscript?: { author?: string }): string {
  const name = slug(title) || slug(copy.structure.defaultBookTitle);
  if (!manuscript) return `${name}.pdf`;
  return `${[slug(surname(manuscript.author)), name, copy.export.manuscriptSuffix].filter(Boolean).join("-")}.pdf`;
}

/** "Naslov-KDP-6x9.pdf". */
export function kdpFileName(title: string, trimId: string): string {
  return `${slug(title) || slug(copy.structure.defaultBookTitle)}-KDP-${trimId}.pdf`;
}

/** "Naslov.epub"; the plain Word file for Kindle is "Naslov-Kindle.docx". */
export function ebookFileName(title: string, format: "epub" | "docx"): string {
  const name = slug(title) || slug(copy.structure.defaultBookTitle);
  return format === "epub" ? `${name}.epub` : `${name}-Kindle.docx`;
}
