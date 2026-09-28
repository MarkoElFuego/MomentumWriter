import { countWords, HAS_WORD_CHAR } from "@/lib/text/countWords";
import { endsMidSentence, SENTENCE_END, splitSentences } from "@/lib/text/sentences";
import type { SparkMode } from "./prompts";
import type { SparkResponse } from "./schemas";

// Golden rule 1: the AI never writes prose for the author. Push may finish the
// sentence the author left open, or offer a *starter* for the next one; every
// other mode gets only questions and notes. These checks catch replies that
// slipped past the prompt.
const MAX_SENTENCES = 2;
const DIALOGUE_START = /^[„"—–]/;
const COPY_RUN = 8;
const MAX_STARTER_WORDS = 5;
const MAX_FINISH_WORDS = 8;

export type GuardrailResult = { ok: true } | { ok: false; reason: string };

export function checkGuardrail(mode: SparkMode, data: SparkResponse, context: string): GuardrailResult {
  const contextRuns = wordRuns(normalizeWords(context));
  const pushCheck = endsMidSentence(context) ? finishProblem : starterProblem;

  for (const raw of collectTexts(data)) {
    const text = raw.trim();
    const reason = mode === "push" ? pushCheck(text) : noteProblem(text);
    if (reason) return { ok: false, reason };
    if ([...wordRuns(normalizeWords(text))].some((run) => contextRuns.has(run))) {
      return { ok: false, reason: "copies-context" };
    }
  }

  return { ok: true };
}

// Finishing the open sentence: short, and it may close that sentence but not start another.
function finishProblem(text: string): string | null {
  if (text.includes("\n")) return "finish-multiline";
  if (countWords(text) > MAX_FINISH_WORDS) return "finish-too-long";
  if (splitSentences(text).filter((sentence) => HAS_WORD_CHAR.test(sentence)).length > 1) {
    return "finish-new-sentence";
  }
  return null;
}

// A starter must stay a fragment the author has to finish.
function starterProblem(text: string): string | null {
  if (text.includes("\n")) return "starter-multiline";
  if (countWords(text) > MAX_STARTER_WORDS) return "starter-too-long";
  if (SENTENCE_END.test(text)) return "starter-complete";
  return null;
}

function noteProblem(text: string): string | null {
  if (DIALOGUE_START.test(text)) return "dialogue";
  const sentences = splitSentences(text).filter((sentence) => HAS_WORD_CHAR.test(sentence));
  if (sentences.length > MAX_SENTENCES) return "too-long";
  return null;
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
