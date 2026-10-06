import { z } from "zod";
import { getLanguage, LANGUAGES } from "@/lib/languages";
import { clip } from "./schemas";
import type { Completer } from "./spark";

// Story memory (Tiron T2): one background call per chapter the author left with
// enough new words. It returns notes about the story — never text for the book.

/** Client and server cut a longer chapter to its last words, in whole paragraphs. */
export const MEMORY_CHAPTER_WORDS = 8_000;
/** Per line Tiron remembers, and lines per list. */
export const MEMORY_ITEM_CHARS = 80;
export const MEMORY_LIST_MAX = 12;

const lines = z.array(z.string().trim().max(MEMORY_ITEM_CHARS)).max(MEMORY_LIST_MAX);
const MemoryListsSchema = z.object({ characters: lines, places: lines, openThreads: lines });
export type MemoryLists = z.infer<typeof MemoryListsSchema>;

export const MemoryRequestSchema = z.object({
  mode: z.literal("memory"),
  /** The chapter's main text (no footnotes), at most MEMORY_CHAPTER_WORDS. */
  text: z.string().trim().min(1).max(80_000),
  /** What the AI remembered so far — it may change these. */
  memory: MemoryListsSchema,
  /** The author's own lines — kept as they are, never repeated. */
  pinned: MemoryListsSchema,
  bookTitle: z.string().max(200),
  chapterTitle: z.string().max(200),
  /** Book.genre — a plain string here so this server module never loads the Dexie schema. */
  genre: z.string().max(40).optional(),
  language: z.enum(LANGUAGES).optional(),
});
export type MemoryRequest = z.infer<typeof MemoryRequestSchema>;

// Overlong lines are clipped and extra ones dropped: a slightly long list is
// still a good memory, and rejecting it would lose the whole chapter.
const items = z.preprocess(
  (value) =>
    Array.isArray(value)
      ? value
          .filter((item): item is string => typeof item === "string")
          .map((item) => clip(item.trim(), MEMORY_ITEM_CHARS))
          .filter((item) => item.length > 0)
          .slice(0, MEMORY_LIST_MAX)
      : value,
  z.array(z.string()),
);

const MemoryReplySchema = z.object({
  characters: items,
  places: items,
  openThreads: items,
  summary: z.preprocess((value) => (typeof value === "string" ? clip(value.trim(), 600) : value), z.string().min(3)),
  bestLine: z.string().trim().optional().default(""),
});

export interface MemoryResult extends MemoryLists {
  summary: string;
  /** Only when it is word for word in the chapter. */
  bestLine?: string;
}

export type MemoryRunResult = { ok: true; data: MemoryResult } | { ok: false; error: "timeout" | "unavailable" };

const collapse = (text: string) => text.replace(/\s+/gu, " ").trim();

/** An exact quote — only runs of spaces and line breaks may differ. */
export function isExactQuote(line: string, text: string): boolean {
  const quote = collapse(line);
  return quote.length > 0 && collapse(text).includes(quote);
}

function listBlock(lists: MemoryLists): string {
  const section = (label: string, list: string[]) =>
    `${label}:\n${list.length ? list.map((item) => `- ${item}`).join("\n") : "- (ništa)"}`;
  return [
    section("Likovi", lists.characters),
    section("Mesta", lists.places),
    section("Otvorene niti", lists.openThreads),
  ].join("\n");
}

export function buildMemoryMessage(request: MemoryRequest): string {
  const head = [`Knjiga: ${request.bookTitle}`];
  if (request.genre) head.push(`Žanr: ${request.genre}`);
  head.push(`Poglavlje: ${request.chapterTitle}`);
  return [
    head.join("\n"),
    `---TRENUTNA MEMORIJA---\n${listBlock(request.memory)}`,
    `---AUTOR UPISAO---\n${listBlock(request.pinned)}`,
    `---POGLAVLJE---\n${request.text}`,
  ].join("\n\n");
}

export function parseMemoryReply(raw: string, text: string): { ok: true; data: MemoryResult } | { ok: false; reason: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  const parsed = MemoryReplySchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "schema" };

  const { bestLine, ...data } = parsed.data;
  if (!bestLine) return { ok: true, data };
  // A sentence that isn't in the chapter is not the author's — drop it, keep the rest.
  if (!isExactQuote(bestLine, text)) {
    console.warn("[memory] bestLine dropped: not in the chapter");
    return { ok: true, data };
  }
  return { ok: true, data: { ...data, bestLine: collapse(bestLine) } };
}

/** One retry inside one deadline, like runSpark. A failure keeps the old memory on the client. */
export async function runMemory(request: MemoryRequest, complete: Completer, signal: AbortSignal): Promise<MemoryRunResult> {
  const system = getLanguage(request.language).prompts.memory;
  const user = buildMemoryMessage(request);

  for (let attempt = 1; attempt <= 2; attempt++) {
    let reason: string;
    try {
      const raw = await complete({ mode: "memory", system, user, signal });
      const parsed = parseMemoryReply(raw, request.text);
      if (parsed.ok) return parsed;
      reason = parsed.reason;
    } catch (error) {
      if (signal.aborted) return { ok: false, error: "timeout" };
      reason = error instanceof Error ? error.message : "request-failed";
    }
    console.warn(`[memory] attempt ${attempt} rejected: ${reason}`);
  }
  return { ok: false, error: "unavailable" };
}
