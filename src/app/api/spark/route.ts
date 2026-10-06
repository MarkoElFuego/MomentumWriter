import { MemoryRequestSchema, runMemory } from "@/lib/ai/memory";
import { createCompleter, MissingAiConfigError } from "@/lib/ai/openai";
import { ProofreadRequestSchema, runProofread } from "@/lib/ai/proofread";
import { SparkRequestSchema } from "@/lib/ai/schemas";
import { runTiron, TironRequestSchema } from "@/lib/ai/tiron";
import { runSpark } from "@/lib/ai/spark";

// One deadline for both attempts — the writer waits at most this long.
const TIMEOUT_MS = 15_000;
// Ghost text is only useful while the writer is still paused.
const GHOST_TIMEOUT_MS = 6_000;
// A long paragraph took 3.4 s in the 5a eval; underlines later than this aren't worth it.
const PROOFREAD_TIMEOUT_MS = 10_000;
// Memory reads a whole chapter with medium reasoning, in the background — nobody waits on it.
const MEMORY_TIMEOUT_MS = 45_000;
// A whisper waits for a pause anyway — medium reasoning may take a while.
const TIRON_TIMEOUT_MS = 30_000;

// Proofread (one paragraph, plain-text reply), memory (a whole chapter) and
// tiron (a whisper) have their own shapes behind the same endpoint.
function parseBody(body: unknown) {
  const proofread = ProofreadRequestSchema.safeParse(body);
  if (proofread.success) return { kind: "proofread", data: proofread.data } as const;
  const memory = MemoryRequestSchema.safeParse(body);
  if (memory.success) return { kind: "memory", data: memory.data } as const;
  const tiron = TironRequestSchema.safeParse(body);
  if (tiron.success) return { kind: "tiron", data: tiron.data } as const;
  const spark = SparkRequestSchema.safeParse(body);
  if (spark.success) return { kind: "spark", data: spark.data } as const;
  return null;
}

function respond(result: { ok: true; data: unknown } | { ok: false; error: "timeout" | "unavailable" }) {
  if (result.ok) return Response.json({ data: result.data });
  return Response.json({ error: result.error }, { status: result.error === "timeout" ? 504 : 502 });
}

export async function POST(request: Request) {
  const input = parseBody(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "bad-request" }, { status: 400 });

  let complete;
  try {
    complete = createCompleter();
  } catch (error) {
    if (!(error instanceof MissingAiConfigError)) throw error;
    console.error(`[spark] ${error.message}`);
    return Response.json({ error: "config" }, { status: 500 });
  }

  if (input.kind === "proofread") {
    return respond(await runProofread(input.data, complete, AbortSignal.timeout(PROOFREAD_TIMEOUT_MS)));
  }
  if (input.kind === "memory") {
    return respond(await runMemory(input.data, complete, AbortSignal.timeout(MEMORY_TIMEOUT_MS)));
  }
  if (input.kind === "tiron") {
    return respond(await runTiron(input.data, complete, AbortSignal.timeout(TIRON_TIMEOUT_MS)));
  }

  const ghost = input.data.mode === "ghost";
  const options = ghost
    ? { maxWords: Number(process.env.AI_GHOST_CONTEXT_WORDS) || 150, attempts: 1 }
    : { maxWords: Number(process.env.AI_CONTEXT_WORDS) || 400 };
  const signal = AbortSignal.timeout(ghost ? GHOST_TIMEOUT_MS : TIMEOUT_MS);
  return respond(await runSpark(input.data, complete, signal, options));
}
