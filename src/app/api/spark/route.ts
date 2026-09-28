import { createCompleter, MissingAiConfigError } from "@/lib/ai/openai";
import { SparkRequestSchema } from "@/lib/ai/schemas";
import { runSpark } from "@/lib/ai/spark";

// One deadline for both attempts — the writer waits at most this long.
const TIMEOUT_MS = 15_000;

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const input = SparkRequestSchema.safeParse(body);
  if (!input.success) return Response.json({ error: "bad-request" }, { status: 400 });

  let complete;
  try {
    complete = createCompleter();
  } catch (error) {
    if (!(error instanceof MissingAiConfigError)) throw error;
    console.error(`[spark] ${error.message}`);
    return Response.json({ error: "config" }, { status: 500 });
  }

  const maxWords = Number(process.env.AI_CONTEXT_WORDS) || 400;
  const result = await runSpark(input.data, complete, AbortSignal.timeout(TIMEOUT_MS), maxWords);

  if (result.ok) return Response.json({ data: result.data });
  return Response.json({ error: result.error }, { status: result.error === "timeout" ? 504 : 502 });
}
