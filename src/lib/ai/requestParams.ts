import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import type { ReasoningEffort } from "openai/resources/shared";

export interface RequestOptions {
  model: string;
  system: string;
  user: string;
  maxCompletionTokens: number;
  /** Omitted → the model's default effort. */
  effort?: ReasoningEffort;
  temperature?: number;
  topP?: number;
  /** "json" (default) → JSON mode; "text" → plain reply (proofread). */
  format?: "json" | "text";
}

/**
 * The only place request params are built. gpt-6-luna answers 400 to
 * temperature/top_p unless reasoning_effort is "none", so they are dropped
 * everywhere else — including when no effort is sent (the default isn't "none").
 */
export function buildRequestParams({
  model,
  system,
  user,
  maxCompletionTokens,
  effort,
  temperature,
  topP,
  format = "json",
}: RequestOptions): ChatCompletionCreateParamsNonStreaming {
  const sampling = effort === "none" ? { temperature, top_p: topP } : {};
  const params: ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: format === "json" ? "json_object" : "text" },
    max_completion_tokens: maxCompletionTokens,
    ...(effort ? { reasoning_effort: effort } : {}),
    ...sampling,
  };
  // Keep undefined keys out of the JSON body entirely.
  if (params.temperature === undefined) delete params.temperature;
  if (params.top_p === undefined) delete params.top_p;
  return params;
}
