import { describe, expect, it } from "vitest";
import { parseSparkResponse, SparkRequestSchema } from "./schemas";

const validPush = {
  items: [
    { kind: "inner", text: "a Marko se plašio" },
    { kind: "outer", text: "kad je neko pokucao" },
    { kind: "shift", text: "Napolju je kiša" },
  ],
};

describe("parseSparkResponse", () => {
  it("accepts a valid push with 3 items", () => {
    const result = parseSparkResponse("push", JSON.stringify(validPush));
    expect(result).toEqual({ ok: true, data: validPush });
  });

  it("accepts a push with 1–3 items but not 0 or 4", () => {
    const twoItems = { items: validPush.items.slice(0, 2) };
    expect(parseSparkResponse("push", JSON.stringify(twoItems)).ok).toBe(true);
    expect(parseSparkResponse("push", JSON.stringify({ items: [] })).ok).toBe(false);
    const four = { items: [...validPush.items, validPush.items[0]] };
    expect(parseSparkResponse("push", JSON.stringify(four))).toEqual({ ok: false, reason: "schema" });
  });

  it("parses a reply wrapped in ```json fences", () => {
    const raw = "```json\n" + JSON.stringify(validPush) + "\n```";
    expect(parseSparkResponse("push", raw).ok).toBe(true);
  });

  it("rejects text that is not JSON", () => {
    expect(parseSparkResponse("complicate", "Evo pitanja: zašto?")).toEqual({
      ok: false,
      reason: "invalid-json",
    });
  });

  it("clips overlong items at a word boundary instead of rejecting them", () => {
    const long = `Zašto ${"Marko ".repeat(60)}ćuti?`;
    const result = parseSparkResponse("complicate", JSON.stringify({ question: long }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.question.length).toBeLessThanOrEqual(220);
    expect(result.data.question).toMatch(/Marko…$/);
  });

  it("clips resume summary lines to 160 characters", () => {
    const line = "Marko je otišao iz grada. ".repeat(10);
    const raw = JSON.stringify({ summary: [line, "Kod kuće je.", "Pismo nije otvoreno."], openQuestion: "Ko je poslao pismo?" });
    const result = parseSparkResponse("resume", raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.summary[0]!.length).toBeLessThanOrEqual(160);
  });

  it("rejects a push item over 80 characters instead of clipping it", () => {
    const long = { items: [...validPush.items.slice(0, 2), { kind: "shift", text: "a".repeat(81) }] };
    expect(parseSparkResponse("push", JSON.stringify(long))).toEqual({ ok: false, reason: "schema" });
  });

  it("rejects missing fields and unknown kinds", () => {
    expect(parseSparkResponse("missing", JSON.stringify({ observation: "Nema mirisa." })).ok).toBe(false);
    const badKind = { items: validPush.items.map((item) => ({ ...item, kind: "other" })) };
    expect(parseSparkResponse("push", JSON.stringify(badKind)).ok).toBe(false);
  });
});

describe("SparkRequestSchema", () => {
  const request = { mode: "push", context: "Petar je", bookTitle: "", chapterTitle: "", sceneTitle: "" };

  it("accepts a known language and requests without one", () => {
    expect(SparkRequestSchema.safeParse({ ...request, language: "sr-Latn" }).success).toBe(true);
    expect(SparkRequestSchema.safeParse(request).success).toBe(true);
  });

  it("rejects an unknown language", () => {
    expect(SparkRequestSchema.safeParse({ ...request, language: "xx" }).success).toBe(false);
  });
});
