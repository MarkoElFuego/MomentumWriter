import { describe, expect, it } from "vitest";
import { buildRequestParams } from "./requestParams";

const base = { model: "gpt-6-luna", system: "s", user: "u", maxCompletionTokens: 1200 };

describe("buildRequestParams", () => {
  it("keeps temperature and top_p with effort none", () => {
    const params = buildRequestParams({ ...base, effort: "none", temperature: 0.2, topP: 0.9 });
    expect(params).toMatchObject({ reasoning_effort: "none", temperature: 0.2, top_p: 0.9 });
  });

  it("drops temperature and top_p with any other effort", () => {
    const params = buildRequestParams({ ...base, effort: "low", temperature: 0.2, topP: 0.9 });
    expect(params.reasoning_effort).toBe("low");
    expect("temperature" in params).toBe(false);
    expect("top_p" in params).toBe(false);
  });

  it("drops them when no effort is sent", () => {
    const params = buildRequestParams({ ...base, temperature: 0.2 });
    expect("reasoning_effort" in params).toBe(false);
    expect("temperature" in params).toBe(false);
  });

  it("sends no sampling keys when none are asked for", () => {
    const params = buildRequestParams({ ...base, effort: "none" });
    expect(Object.keys(params).sort()).toEqual(
      ["max_completion_tokens", "messages", "model", "reasoning_effort", "response_format"],
    );
  });

  it("asks for plain text when format is text", () => {
    expect(buildRequestParams({ ...base, format: "text" }).response_format).toEqual({ type: "text" });
    expect(buildRequestParams(base).response_format).toEqual({ type: "json_object" });
  });
});
