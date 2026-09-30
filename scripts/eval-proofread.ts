// v0.2 Faza 5a: runs every case in scripts/proofread-cases.json through two
// request variants and compares them, so the author can pick one before the UI.
// Usage: pnpm eval:proofread       (A and B)
//        pnpm eval:proofread A     (only variants whose label starts with A)
import { readFileSync } from "node:fs";
import OpenAI from "openai";
import type { ReasoningEffort } from "openai/resources/shared";
import { buildRequestParams } from "@/lib/ai/requestParams";
import { getLanguage } from "@/lib/languages";

interface Case {
  name: string;
  input: string;
  expected: string;
}

interface Variant {
  label: string;
  effort: ReasoningEffort;
  temperature?: number;
}

const VARIANTS: Variant[] = [
  { label: "A (none, t=0.2)", effort: "none", temperature: 0.2 },
  { label: "B (low)", effort: "low" },
];

// Room for reasoning on "low" plus a whole corrected paragraph.
const MAX_TOKENS = 2000;

interface Score {
  correct: number;
  wrong: number;
  missed: number;
  /** Word count differs from the input — no word-by-word comparison possible. */
  structure: boolean;
  exact: boolean;
}

interface Run {
  output: string;
  ms: number;
  outTokens: number;
  score: Score;
  error?: string;
}

const words = (text: string) => text.trim().split(/\s+/u).filter(Boolean);

function score(input: string, expected: string, output: string): Score {
  const i = words(input);
  const e = words(expected);
  const o = words(output);
  const result: Score = { correct: 0, wrong: 0, missed: 0, structure: false, exact: output.trim() === expected };
  if (o.length !== i.length || e.length !== i.length) return { ...result, structure: true };
  i.forEach((original, k) => {
    const needed = original !== e[k];
    if (needed && o[k] === e[k]) result.correct++;
    else if (needed && o[k] === original) result.missed++;
    // Changed a correct word, or fixed a wrong one the wrong way.
    else if (o[k] !== e[k]) result.wrong++;
  });
  return result;
}

async function run(client: OpenAI, model: string, variant: Variant, item: Case): Promise<Run> {
  const started = performance.now();
  try {
    const completion = await client.chat.completions.create(
      buildRequestParams({
        model,
        system: getLanguage("sr-Latn").prompts.proofreader,
        user: item.input,
        maxCompletionTokens: MAX_TOKENS,
        effort: variant.effort,
        temperature: variant.temperature,
        format: "text",
      }),
    );
    const ms = Math.round(performance.now() - started);
    const output = completion.choices[0]?.message.content?.trim() ?? "";
    const usage = completion.usage;
    const cached = usage?.prompt_tokens_details?.cached_tokens ?? 0;
    const reasoning = usage?.completion_tokens_details?.reasoning_tokens ?? 0;
    console.log(
      `[proofread] ${variant.label} ${ms}ms in=${usage?.prompt_tokens ?? "?"} cached=${cached} out=${usage?.completion_tokens ?? "?"} (reasoning=${reasoning})`,
    );
    return { output, ms, outTokens: usage?.completion_tokens ?? 0, score: score(item.input, item.expected, output) };
  } catch (error) {
    const ms = Math.round(performance.now() - started);
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[proofread] ${variant.label} ${ms}ms ERROR ${message}`);
    return {
      output: "",
      ms,
      outTokens: 0,
      score: { correct: 0, wrong: 0, missed: 0, structure: false, exact: false },
      error: message,
    };
  }
}

function describe(result: Run): string {
  if (result.error) return `GREŠKA: ${result.error}`;
  if (result.score.exact) return "✓ tačno";
  const { correct, wrong, missed, structure } = result.score;
  const verdict = structure ? "broj reči promenjen" : `+${correct} ✗${wrong} –${missed}`;
  return `${verdict}\n      → ${result.output}`;
}

async function main() {
  process.loadEnvFile(".env.local");
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!apiKey || !model) throw new Error("OPENAI_API_KEY ili AI_MODEL nije podešen u .env.local");

  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 60_000 });
  const cases = JSON.parse(readFileSync("scripts/proofread-cases.json", "utf8")) as Case[];
  const only = process.argv[2]?.toUpperCase();
  const variants = only ? VARIANTS.filter((v) => v.label.startsWith(only)) : VARIANTS;
  if (variants.length === 0) throw new Error(`Nema varijante „${only}” — postoje: A, B`);
  const results = new Map<string, Run[]>(variants.map((v) => [v.label, []]));

  console.log(`Model: ${model} · ${cases.length} slučajeva × ${variants.length} varijante\n`);
  for (const item of cases) {
    console.log(`## ${item.name}`);
    for (const variant of variants) {
      const result = await run(client, model, variant, item);
      results.get(variant.label)!.push(result);
      console.log(`   ${variant.label}: ${describe(result)}`);
    }
    if ([...results.values()].some((runs) => runs.at(-1)?.score.exact !== true)) console.log(`   očekivano: ${item.expected}`);
    console.log("");
  }

  const sum = (runs: Run[], pick: (r: Run) => number) => runs.reduce((total, r) => total + pick(r), 0);
  const avg = (runs: Run[], pick: (r: Run) => number) => Math.round(sum(runs, pick) / Math.max(runs.length, 1));
  const rows = variants.map(({ label }) => {
    const runs = results.get(label)!;
    return {
      varijanta: label,
      "tačno ceo pasus": `${runs.filter((r) => r.score.exact).length}/${runs.length}`,
      "tačne ispravke": sum(runs, (r) => r.score.correct),
      "pogrešne izmene": sum(runs, (r) => r.score.wrong),
      "propuštene greške": sum(runs, (r) => r.score.missed),
      "broj reči promenjen": runs.filter((r) => r.score.structure).length,
      greške: runs.filter((r) => r.error).length,
      "prosečno ms": avg(runs, (r) => r.ms),
      "prosečno out tokena": avg(runs, (r) => r.outTokens),
    };
  });
  console.log(`## ${variants.map((v) => v.label).join(" vs ")}`);
  console.table(rows);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
