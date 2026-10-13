import type { StoryMemory } from "@/lib/db/schema";

// How the Knjiga section shows what Tiron remembers (POL2). A memory item is one
// text ("Lokusta — otrovačica iz Galije"); the panel shows a name and a line under it.

/** The name is up to the first dash between spaces, or the first colon. No dash → all of it is the name. */
export function splitItem(text: string): { name: string; desc: string } {
  const t = text.trim();
  const m = t.match(/^(.+?)\s+[—–-]\s+(.+)$/su) ?? t.match(/^(.+?):\s+(.+)$/su);
  return m ? { name: m[1]!.trim(), desc: m[2]!.trim() } : { name: t, desc: "" };
}

/** The letter in the circle. Serbian Lj, Nj, Dž are one letter. */
export function initialOf(name: string): string {
  const t = name.trim();
  const two = t.slice(0, 2);
  if (/^(lj|nj|dž)$/iu.test(two)) return two[0]!.toUpperCase() + two[1]!.toLowerCase();
  return t.charAt(0).toUpperCase();
}

/** Odluka autora (POL2): a book without words and without memories shows only Srce knjige. */
export function showsMemory(hasText: boolean, memory: StoryMemory | null): boolean {
  return hasText || Boolean(memory && (memory.characters.length || memory.places.length || memory.openThreads.length));
}

/** The first `limit` items, or all of them once the author asked for „još N”. */
export function visibleItems<T>(items: T[], limit: number, expanded: boolean): { shown: T[]; hidden: number } {
  if (expanded || items.length <= limit) return { shown: items, hidden: 0 };
  return { shown: items.slice(0, limit), hidden: items.length - limit };
}
