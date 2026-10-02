import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkGuardrail } from "./guardrail";
import { buildSystemPrompt, buildUserMessage } from "./prompts";
import { buildRequestParams } from "./requestParams";
import { parseSparkResponse, SparkRequestSchema, type SparkRequest } from "./schemas";
import { runSpark, type Completer } from "./spark";

const context =
  "Kiša je padala celu noć. Petar je stajao na pragu i gledao u mračno dvorište iza stare kuće. Kofer je ostao kod Mare.";
const ask = (question: string) => ({ question });

describe("stuck — reply shape", () => {
  it("accepts one question", () => {
    expect(parseSparkResponse("stuck", JSON.stringify(ask("Šta Petar zna o koferu?")))).toEqual({
      ok: true,
      data: { question: "Šta Petar zna o koferu?" },
    });
  });

  it("never clips a long question — the guardrail rejects it instead", () => {
    const long = `${"Šta bi se desilo kad bi Petar konačno ušao u dvorište ".repeat(5).trim()}?`;
    const parsed = parseSparkResponse("stuck", JSON.stringify(ask(long)));
    expect(parsed.ok && parsed.data).toEqual({ question: long });
    expect(checkGuardrail("stuck", ask(long), context)).toEqual({ ok: false, reason: "stuck-too-long" });
  });

  it("accepts at most 5 earlier questions to avoid", () => {
    const base = { mode: "stuck", context, bookTitle: "Kiša", chapterTitle: "Poglavlje I" };
    expect(SparkRequestSchema.safeParse({ ...base, avoid: ["a?", "b?", "c?", "d?", "e?"] }).success).toBe(true);
    expect(SparkRequestSchema.safeParse({ ...base, avoid: ["a?", "b?", "c?", "d?", "e?", "f?"] }).success).toBe(false);
  });
});

describe("stuck — guardrail", () => {
  it("keeps a short question about the scene", () => {
    expect(checkGuardrail("stuck", ask("Zašto Petar ne pita Maru za kofer?"), context).ok).toBe(true);
  });

  it("allows a closing quote after the question mark", () => {
    expect(checkGuardrail("stuck", ask("Šta Mara misli kad kaže „kasno je?”"), context).ok).toBe(true);
  });

  it("rejects an answer that is not a question", () => {
    expect(checkGuardrail("stuck", ask("Petar bi mogao da ode po kofer."), context)).toEqual({
      ok: false,
      reason: "stuck-not-question",
    });
  });

  it("rejects dialogue, three sentences and copied text", () => {
    expect(checkGuardrail("stuck", ask("— Ko je tamo, Petre?"), context)).toEqual({ ok: false, reason: "dialogue" });
    expect(checkGuardrail("stuck", ask("Kiša pada. Petar čeka. Šta sada?"), context)).toEqual({
      ok: false,
      reason: "too-long",
    });
    expect(
      checkGuardrail("stuck", ask("Zašto je Petar stajao na pragu i gledao u mračno dvorište iza stare kuće?"), context),
    ).toEqual({ ok: false, reason: "copies-context" });
  });
});

describe("stuck — prompt", () => {
  it("speaks as Tiron and asks about this scene, ending with a question mark", () => {
    const system = buildSystemPrompt("stuck", "sr-Latn");
    expect(system.startsWith("Ti si Tiron")).toBe(true);
    expect(system).toContain("Postavi pitanje o OVOJ sceni, ne opšti savet o pisanju");
    expect(system).toContain("Pitanje mora da se završi upitnikom");
    expect(system).not.toContain("književni urednik");
  });

  it("lists earlier questions so the next one is different", () => {
    const fields = { bookTitle: "Kiša", chapterTitle: "Poglavlje I", context: "Tekst." };
    expect(buildUserMessage("stuck", fields)).not.toContain("NE PONAVLJAJ");
    expect(buildUserMessage("stuck", { ...fields, avoid: ["Šta Mara krije?", "Gde je kofer?"] })).toContain(
      "---NE PONAVLJAJ---\n- Šta Mara krije?\n- Gde je kofer?",
    );
  });

  it("goes out with effort low and no temperature", () => {
    const params = buildRequestParams({ model: "m", system: "s", user: "u", maxCompletionTokens: 1200, effort: "low", temperature: 0.7 });
    expect(params.reasoning_effort).toBe("low");
    expect(params).not.toHaveProperty("temperature");
  });
});

describe("stuck — one more try", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("asks again once when the first reply is not a question", async () => {
    const replies = [JSON.stringify(ask("Petar ide po kofer.")), JSON.stringify(ask("Šta Petar očekuje u koferu?"))];
    const complete = vi.fn<Completer>(async () => replies.shift() ?? "");
    const request: SparkRequest = { mode: "stuck", context, bookTitle: "Kiša", chapterTitle: "Poglavlje I" };
    const result = await runSpark(request, complete, new AbortController().signal);
    expect(result).toEqual({ ok: true, data: { question: "Šta Petar očekuje u koferu?" } });
    expect(complete).toHaveBeenCalledTimes(2);
  });
});
