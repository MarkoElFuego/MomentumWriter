// Text from the manuscript goes into Typst markup, where many characters mean
// something: # starts code, * and _ emphasis, $ math, @ a reference, < a label,
// = - + / at a line start a heading or a list, "1." a numbered list, // a comment,
// -- and ... become dashes and an ellipsis, " and ' smart quotes. A backslash
// in front makes each of them a plain character, so the book prints exactly as
// written (ZADATAK_IZVOZ, pravilo 4).

const SPECIAL = /[\\#*_`$@<>[\]~=+\-/"'.]/g;

/** Plain text → Typst markup that prints the same characters. Line breaks become spaces. */
export function escapeMarkup(text: string): string {
  return text.replace(/\r\n?|[\n\t]/g, " ").replace(SPECIAL, "\\$&");
}

/** Plain text → a Typst string literal, for parameters such as the PDF title. */
export function typstString(text: string): string {
  return `"${text.replace(/\r\n?|[\n\t]/g, " ").replace(/[\\"]/g, "\\$&")}"`;
}
