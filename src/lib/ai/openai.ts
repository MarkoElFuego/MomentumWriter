import OpenAI from "openai";
import { MAX_COMPLETION_TOKENS } from "./prompts";
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

  return async ({ system, user, signal }) => {
    const completion = await client.chat.completions.create(
      {
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: MAX_COMPLETION_TOKENS,
      },
      { signal },
    );
    const choice = completion.choices[0];
    if (!choice?.message.content) {
      throw new Error(`empty reply (finish_reason: ${choice?.finish_reason ?? "none"})`);
    }
    return choice.message.content;
  };
}
