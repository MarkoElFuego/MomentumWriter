import { extractContext } from "@/lib/text/extractContext";
import { checkGuardrail } from "./guardrail";
import { buildSystemPrompt, buildUserMessage, type SparkMode } from "./prompts";
import { parseSparkResponse, type SparkRequest, type SparkResponse } from "./schemas";

// The model call is injected so the retry/guardrail flow is testable without the SDK.
export type Completer = (call: {
  mode: SparkMode;
  system: string;
  user: string;
  signal: AbortSignal;
}) => Promise<string>;

export type SparkResult =
  | { ok: true; data: SparkResponse }
  | { ok: false; error: "timeout" | "unavailable" };

const MAX_ATTEMPTS = 2;

export async function runSpark(
  request: SparkRequest,
  complete: Completer,
  signal: AbortSignal,
  maxWords = 400,
): Promise<SparkResult> {
  // The client already trims, but the server is what pays for tokens.
  const context = extractContext(
    { textBetween: (from, to) => request.context.slice(from, to) },
    request.context.length,
    maxWords,
  );
  const system = buildSystemPrompt(request.mode);
  const user = buildUserMessage({ ...request, context });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let reason: string;
    try {
      const raw = await complete({ mode: request.mode, system, user, signal });
      const parsed = parseSparkResponse(request.mode, raw);
      if (parsed.ok) {
        const guard = checkGuardrail(parsed.data, context);
        if (guard.ok) return { ok: true, data: parsed.data };
        reason = guard.reason;
      } else {
        reason = parsed.reason;
      }
    } catch (error) {
      if (signal.aborted) return { ok: false, error: "timeout" };
      reason = error instanceof Error ? error.message : "request-failed";
    }
    console.warn(`[spark] ${request.mode} attempt ${attempt} rejected: ${reason}`);
  }

  return { ok: false, error: "unavailable" };
}
