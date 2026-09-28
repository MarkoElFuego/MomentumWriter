// Break after . ! ? … (plus any closing quotes/brackets) followed by whitespace.
export const SENTENCE_BREAK = /(?<=[.!?…]["'“”’»)]*)\s+/u;

export function splitSentences(text: string): string[] {
  return text
    .trim()
    .split(SENTENCE_BREAK)
    .filter((sentence) => sentence !== "");
}
