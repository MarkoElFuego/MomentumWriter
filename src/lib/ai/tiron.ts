import { z } from "zod";
import { getLanguage, LANGUAGES } from "@/lib/languages";
import { PATTERNS } from "@/lib/process/patterns";
import { HAS_WORD_CHAR } from "@/lib/text/countWords";
import { splitSentences } from "@/lib/text/sentences";
import type { Completer } from "./spark";

// Tiron's whispers (T5): two short sentences at a turning point — entering the
// book, the end of a chapter, the end of a session, or a process pattern. Never
// text for the book, never a verdict on the draft.

export const WHISPER_MOMENTS = ["entry", "pattern", "chapterEnd", "sessionEnd"] as const;
export const WHISPER_KINDS = ["story", "process", "win", "why"] as const;
export const MAX_WHISPER_CHARS = 220;
/** ~1500 words of the chapter or the session. */
export const WHISPER_TEXT_WORDS = 1_500;

const line = (max: number) => z.string().trim().max(max);

const SignalsSchema = z.object({
  daysSinceLastSession: z.number().nullable(),
  sessionsLast7Days: z.number(),
  rewriteRatio: z.number(),
  restartsOfCurrentPart: z.number(),
  bookPosition: z.enum(["početak", "sredina", "kraj"]).nullable(),
  typicalHour: z.number().nullable(),
  trend: z.enum(["pad", "stabilno"]).nullable(),
});

export const TironRequestSchema = z.object({
  mode: z.literal("tiron"),
  moment: z.enum(WHISPER_MOMENTS),
  pattern: z.enum(PATTERNS).optional(),
  bookTitle: z.string().max(200),
  language: z.enum(LANGUAGES).optional(),
  heart: z.object({ about: line(1000).optional(), ending: line(1000).optional(), why: line(1000).optional() }).optional(),
  /** compactMemory — characters, places, open threads. */
  memory: line(1500).optional(),
  summaries: z.array(z.object({ label: line(200), summary: line(800) })).max(60).optional(),
  signals: SignalsSchema.optional(),
  /** The end of the chapter, or what was written in the session. */
  text: line(15_000).optional(),
  /** Book.bestLines — the only sentences a quote may come from. */
  bestLines: z.array(line(600)).max(60).optional(),
  /** The last whispers, so this one says something new. */
  previous: z.array(line(300)).max(5).optional(),
});
export type TironRequest = z.infer<typeof TironRequestSchema>;

const WhisperReplySchema = z.object({
  whisper: z.string().trim().min(3),
  kind: z.enum(WHISPER_KINDS),
  quote: z.string().trim().optional(),
});
export interface WhisperResult {
  whisper: string;
  kind: (typeof WHISPER_KINDS)[number];
  /** Only when it is one of the best lines that were sent. */
  quote?: string;
}

/** The end of a session (T6): what moved in the story, and one question for next time. */
export interface WinResult {
  progress: string;
  tomorrow: string;
}
export const MAX_WIN_CHARS = 160;

const WinReplySchema = z.object({
  progress: z.string().trim().min(3),
  tomorrow: z.string().trim().min(3),
});

export type TironResult = { ok: true; data: WhisperResult | WinResult } | { ok: false; error: "timeout" | "unavailable" };

function signalLines(signals: z.infer<typeof SignalsSchema>): string {
  const lines = [
    signals.daysSinceLastSession !== null && `Dana od poslednje sesije: ${signals.daysSinceLastSession}`,
    `Sesija u poslednjih 7 dana: ${signals.sessionsLast7Days}`,
    `Udeo obrisanih reči u poslednje 3 sesije: ${Math.round(signals.rewriteRatio * 100)}%`,
    `Sesija na ovom poglavlju sa malim napretkom: ${signals.restartsOfCurrentPart}`,
    signals.bookPosition && `Mesto u knjizi: ${signals.bookPosition}`,
    signals.typicalHour !== null && `Najčešće piše oko: ${signals.typicalHour} h`,
    signals.trend && `Dužina sesija: ${signals.trend === "pad" ? "u padu" : "stabilna"}`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** Only the parts that have something in them. */
export function buildTironMessage(request: TironRequest): string {
  const parts = [`Knjiga: ${request.bookTitle}`, `---TRENUTAK---\n${request.moment}`];
  if (request.pattern) parts.push(`---OBRAZAC---\n${request.pattern}`);
  const heart = request.heart;
  if (heart && (heart.about || heart.ending || heart.why)) {
    const lines = [
      heart.about && `O čemu je: ${heart.about}`,
      heart.ending && `Kako se završava: ${heart.ending}`,
      heart.why && `Zašto je piše: ${heart.why}`,
    ];
    parts.push(`---SRCE KNJIGE---\n${lines.filter(Boolean).join("\n")}`);
  }
  if (request.memory) parts.push(`---ŠTA TIRON PAMTI---\n${request.memory}`);
  if (request.summaries?.length) {
    parts.push(`---SAŽECI---\n${request.summaries.map(({ label, summary }) => `${label}: ${summary}`).join("\n")}`);
  }
  if (request.signals) parts.push(`---SIGNALI---\n${signalLines(request.signals)}`);
  if (request.text) parts.push(`---TEKST---\n${request.text}`);
  if (request.bestLines?.length) parts.push(`---NAJJAČE REČENICE---\n${request.bestLines.map((l) => `- ${l}`).join("\n")}`);
  if (request.previous?.length) parts.push(`---PRETHODNI ŠAPATI---\n${request.previous.map((w) => `- ${w}`).join("\n")}`);
  return parts.join("\n\n");
}

const DIALOGUE_START = /^[„"“«»'—–-]/u;
// Golden rules: no verdict on the draft, never "trebalo bi". Whole words only (š is not \w).
const JUDGMENT =
  /(?<!\p{L})(loš[eaiu]?|slab[oaie]?|dosad(?:no|an|na|ni)|greška u pisanju|trebalo bi)(?!\p{L})/iu;

/** Why a whisper may not be shown, or null. */
export function whisperProblem(text: string): string | null {
  if (text.length > MAX_WHISPER_CHARS) return "whisper-too-long";
  if (DIALOGUE_START.test(text)) return "dialogue";
  if (splitSentences(text).filter((sentence) => HAS_WORD_CHAR.test(sentence)).length > 2) return "too-long";
  if (JUDGMENT.test(text)) return "judgment";
  return null;
}

const ENDS_WITH_QUESTION = /\?[”"»’')\]]*$/u;
const sentenceCount = (text: string) => splitSentences(text).filter((sentence) => HAS_WORD_CHAR.test(sentence)).length;

/** Why a small win may not be shown, or null: one sentence each, the second a question, no verdicts. */
export function winProblem({ progress, tomorrow }: WinResult): string | null {
  if (progress.length > MAX_WIN_CHARS || tomorrow.length > MAX_WIN_CHARS) return "win-too-long";
  if (DIALOGUE_START.test(progress) || DIALOGUE_START.test(tomorrow)) return "dialogue";
  if (sentenceCount(progress) > 1 || sentenceCount(tomorrow) > 1) return "win-sentences";
  if (!ENDS_WITH_QUESTION.test(tomorrow)) return "win-not-question";
  if (JUDGMENT.test(progress) || JUDGMENT.test(tomorrow)) return "judgment";
  return null;
}

export function parseWinReply(raw: string): { ok: true; data: WinResult } | { ok: false; reason: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  const parsed = WinReplySchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "schema" };
  const problem = winProblem(parsed.data);
  return problem ? { ok: false, reason: problem } : { ok: true, data: parsed.data };
}

const collapse = (text: string) => text.replace(/\s+/gu, " ").trim();

export function parseWhisperReply(raw: string, bestLines: string[] = []): { ok: true; data: WhisperResult } | { ok: false; reason: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  const parsed = WhisperReplySchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "schema" };
  const { whisper, kind, quote } = parsed.data;
  const problem = whisperProblem(whisper);
  if (problem) return { ok: false, reason: problem };
  // A quote must be the author's own sentence, as saved — otherwise the whisper goes without it.
  const known = quote ? bestLines.find((line) => collapse(line) === collapse(quote)) : undefined;
  if (quote && !known) console.warn("[tiron] quote dropped: not one of the best lines");
  return { ok: true, data: known ? { whisper, kind, quote: known } : { whisper, kind } };
}

/** One retry inside one deadline, like runSpark. */
export async function runTiron(request: TironRequest, complete: Completer, signal: AbortSignal): Promise<TironResult> {
  const prompts = getLanguage(request.language).prompts;
  const system = `${prompts.tiron}\n\n${prompts.whisper}`;
  const user = buildTironMessage(request);

  for (let attempt = 1; attempt <= 2; attempt++) {
    let reason: string;
    try {
      const raw = await complete({ mode: "tiron", moment: request.moment, system, user, signal });
      // The end of a session answers with a small win instead of a whisper (T6).
      const parsed = request.moment === "sessionEnd" ? parseWinReply(raw) : parseWhisperReply(raw, request.bestLines);
      if (parsed.ok) return parsed;
      reason = parsed.reason;
    } catch (error) {
      if (signal.aborted) return { ok: false, error: "timeout" };
      reason = error instanceof Error ? error.message : "request-failed";
    }
    console.warn(`[tiron] ${request.moment} attempt ${attempt} rejected: ${reason}`);
  }
  return { ok: false, error: "unavailable" };
}
