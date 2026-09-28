import { HAS_WORD_CHAR } from "@/lib/text/countWords";
import { splitSentences } from "@/lib/text/sentences";
import type { SparkResponse } from "./schemas";

// Golden rule 1: the AI never writes prose. These checks catch replies that
// slipped past the prompt — dialogue, paragraphs, or continued manuscript text.
const MAX_SENTENCES = 2;
const DIALOGUE_START = /^[„"—–]/;
const COPY_RUN = 8;

export type GuardrailResult = { ok: true } | { ok: false; reason: string };

export function checkGuardrail(data: SparkResponse, context: string): GuardrailResult {
  const contextRuns = wordRuns(normalizeWords(context));

  for (const text of collectTexts(data)) {
    if (DIALOGUE_START.test(text.trim())) return { ok: false, reason: "dialogue" };
    const sentences = splitSentences(text).filter((sentence) => HAS_WORD_CHAR.test(sentence));
    if (sentences.length > MAX_SENTENCES) return { ok: false, reason: "too-long" };
    if ([...wordRuns(normalizeWords(text))].some((run) => contextRuns.has(run))) {
      return { ok: false, reason: "copies-context" };
    }
  }

  return { ok: true };
}

// Every user-facing string in the response; `kind` is a label, not text.
function collectTexts(value: unknown, key?: string): string[] {
  if (typeof value === "string") return key === "kind" ? [] : [value];
  if (Array.isArray(value)) return value.flatMap((entry) => collectTexts(entry));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => collectTexts(v, k));
  }
  return [];
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((token) => token !== "");
}

function wordRuns(words: string[]): Set<string> {
  const runs = new Set<string>();
  for (let i = 0; i + COPY_RUN <= words.length; i++) {
    runs.add(words.slice(i, i + COPY_RUN).join(" "));
  }
  return runs;
}
