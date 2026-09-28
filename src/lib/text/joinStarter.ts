// No space after these: the starter belongs right against them.
const OPENS = /[\s„“"'‘(«[]/u;
// A starter that starts with these attaches to the previous word.
const ATTACHES = /^[,.;:!?…)»”’]/u;

/**
 * The text to insert at the cursor for a chosen starter: a separating space
 * when needed, and always a trailing space so the author keeps typing.
 */
export function joinStarter(charBefore: string, starter: string): string {
  const text = starter.trim();
  const needsSpace = charBefore !== "" && !OPENS.test(charBefore) && !ATTACHES.test(text);
  return `${needsSpace ? " " : ""}${text} `;
}
