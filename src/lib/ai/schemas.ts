import { z } from "zod";
import { LANGUAGES } from "@/lib/languages";
import { SPARK_MODES, type SparkMode } from "./prompts";

export const SparkRequestSchema = z.object({
  mode: z.enum(SPARK_MODES),
  context: z.string().trim().min(1).max(20_000),
  bookTitle: z.string().max(200),
  /** Heading of the open part: "Poglavlje IV · Dolazak", "Posveta"… */
  chapterTitle: z.string().max(200),
  /** Book language; older clients omit it → DEFAULT_LANGUAGE. */
  language: z.enum(LANGUAGES).optional(),
  /** Stuck: the last questions asked (at most 5), so "Još jedno" asks something new. */
  avoid: z.array(z.string().max(300)).max(5).optional(),
  /** Stuck: how the book ends, from Srce knjige — never sent with ghost. */
  ending: z.string().trim().max(1000).optional(),
});
export type SparkRequest = z.infer<typeof SparkRequestSchema>;

// AGENTS.md §7: overlong items are clipped, not rejected — a slightly long
// but good question is still worth showing.
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

const item = (max = 220) =>
  z.preprocess(
    (value) => (typeof value === "string" ? clip(value.trim(), max) : value),
    z.string().min(3).max(max),
  );

// Ghost items (finishing the sentence or starting the next) are never
// clipped — a cut-off suggestion reads wrong — and the guardrail drops bad ones
// individually, so 1–3 items is a valid answer.
export const GhostSchema = z.object({
  items: z
    .array(z.object({ kind: z.enum(["finish", "inner", "outer", "shift"]), text: z.string().trim().min(1).max(80) }))
    .min(1)
    .max(3),
});
export const ResumeSchema = z.object({
  summary: z.array(item(160)).length(3),
  openQuestion: item(),
});

// Never clipped: a question cut short without its "?" reads like a bug.
// The guardrail rejects one that is too long, and the call is tried once more.
export const StuckSchema = z.object({
  question: z.string().trim().min(3),
});

export const SCHEMAS = {
  resume: ResumeSchema,
  ghost: GhostSchema,
  stuck: StuckSchema,
} satisfies Record<SparkMode, z.ZodType>;

export type SparkResponse<M extends SparkMode = SparkMode> = z.infer<(typeof SCHEMAS)[M]>;

export type ParseResult<T> = { ok: true; data: T } | { ok: false; reason: string };

function stripFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

export function parseSparkResponse<M extends SparkMode>(
  mode: M,
  raw: string,
): ParseResult<SparkResponse<M>> {
  let json: unknown;
  try {
    json = JSON.parse(stripFences(raw));
  } catch {
    return { ok: false, reason: "invalid-json" };
  }

  const result = SCHEMAS[mode].safeParse(json);
  if (!result.success) return { ok: false, reason: "schema" };
  return { ok: true, data: result.data as SparkResponse<M> };
}
