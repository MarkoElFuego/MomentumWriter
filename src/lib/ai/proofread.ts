import { z } from "zod";
import { getLanguage, LANGUAGES } from "@/lib/languages";
import { countWords } from "@/lib/text/countWords";
import { wordCountClose } from "@/lib/text/proofDiff";
import type { Completer } from "./spark";

// Proofread is the one mode that may change the author's text — and even then
// only as word-by-word corrections the author accepts (lib/text/proofDiff).
// The model returns the whole corrected paragraph as plain text, not JSON.

/** Variant A from the 5a eval: 23/23 cases, no wrong changes, ~1.2 s. */
export const PROOFREAD_EFFORT = "none";
export const PROOFREAD_TEMPERATURE = 0.2;
/** One paragraph; longer ones are not sent (the reply would take too long). */
export const MAX_PROOFREAD_WORDS = 400;

export const ProofreadRequestSchema = z.object({
  mode: z.literal("proofread"),
  text: z
    .string()
    .trim()
    .min(1)
    .max(4_000)
    .refine((text) => countWords(text) <= MAX_PROOFREAD_WORDS),
  language: z.enum(LANGUAGES).optional(),
});
export type ProofreadRequest = z.infer<typeof ProofreadRequestSchema>;

export type ProofreadResult =
  | { ok: true; data: { corrected: string } }
  | { ok: false; error: "timeout" | "unavailable" };

// The prompt forbids wrappers, but a stray fence or pair of quotes around the
// whole reply would turn every edge word into a "correction".
function unwrap(raw: string, original: string): string {
  let text = raw.trim().replace(/^```\w*\s*/u, "").replace(/\s*```$/u, "");
  const quoted = /^["„“](.*)["”“]$/su.exec(text);
  if (quoted && !/^["„“]/u.test(original)) text = quoted[1]!.trim();
  return text;
}

/** One attempt: a missed proofread costs nothing — the next Enter asks again. */
export async function runProofread(
  request: ProofreadRequest,
  complete: Completer,
  signal: AbortSignal,
): Promise<ProofreadResult> {
  let raw: string;
  try {
    raw = await complete({
      mode: "proofread",
      system: getLanguage(request.language).prompts.proofreader,
      user: request.text,
      signal,
    });
  } catch (error) {
    if (signal.aborted) return { ok: false, error: "timeout" };
    console.warn(`[proofread] failed: ${error instanceof Error ? error.message : "request-failed"}`);
    return { ok: false, error: "unavailable" };
  }

  const corrected = unwrap(raw, request.text);
  if (!wordCountClose(request.text, corrected)) {
    console.warn("[proofread] rejected: word-count");
    return { ok: false, error: "unavailable" };
  }
  return { ok: true, data: { corrected } };
}
