import OpenAI from "openai";
import type { ReasoningEffort } from "openai/resources/shared";
import { MAX_COMPLETION_TOKENS } from "./prompts";
import { buildRequestParams } from "./requestParams";
import type { Completer } from "./spark";

// Server only — the only module that touches the API key.

export class MissingAiConfigError extends Error {
  constructor() {
    super("OPENAI_API_KEY or AI_MODEL is not set");
  }
}

export function createCompleter(): Completer {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!apiKey || !model) throw new MissingAiConfigError();

  // runSpark owns the single retry; SDK retries would multiply it.
  const client = new OpenAI({ apiKey, maxRetries: 0 });

  // Ghost text must arrive while the writer is still paused; a few words don't
  // need deep reasoning. Configurable because not every model supports every level.
  const ghostEffort = (process.env.AI_GHOST_REASONING_EFFORT || "none") as ReasoningEffort;

  return async ({ mode, system, user, signal }) => {
    const completion = await client.chat.completions.create(
      buildRequestParams({
        model,
        system,
        user,
        maxCompletionTokens: MAX_COMPLETION_TOKENS,
        effort: mode === "ghost" ? ghostEffort : undefined,
      }),
      { signal },
    );
    const choice = completion.choices[0];
    if (!choice?.message.content) {
      throw new Error(`empty reply (finish_reason: ${choice?.finish_reason ?? "none"})`);
    }
    return choice.message.content;
  };
}
