import { describe, expect, it } from "vitest";
import { parseSparkResponse, SparkRequestSchema } from "./schemas";

const validGhost = {
  items: [
    { kind: "inner", text: "a Marko se plašio" },
    { kind: "outer", text: "kad je neko pokucao" },
    { kind: "shift", text: "Napolju je kiša" },
  ],
};

describe("parseSparkResponse", () => {
  it("accepts a valid ghost reply with 3 items", () => {
    const result = parseSparkResponse("ghost", JSON.stringify(validGhost));
    expect(result).toEqual({ ok: true, data: validGhost });
  });

  it("accepts a ghost reply with 1–3 items but not 0 or 4", () => {
    const twoItems = { items: validGhost.items.slice(0, 2) };
    expect(parseSparkResponse("ghost", JSON.stringify(twoItems)).ok).toBe(true);
    expect(parseSparkResponse("ghost", JSON.stringify({ items: [] })).ok).toBe(false);
    const four = { items: [...validGhost.items, validGhost.items[0]] };
    expect(parseSparkResponse("ghost", JSON.stringify(four))).toEqual({ ok: false, reason: "schema" });
  });

  it("parses a reply wrapped in ```json fences", () => {
    const raw = "```json\n" + JSON.stringify(validGhost) + "\n```";
    expect(parseSparkResponse("ghost", raw).ok).toBe(true);
  });

  it("rejects text that is not JSON", () => {
    expect(parseSparkResponse("resume", "Evo pitanja: zašto?")).toEqual({
      ok: false,
      reason: "invalid-json",
    });
  });

  it("clips overlong items at a word boundary instead of rejecting them", () => {
    const long = `Zašto ${"Marko ".repeat(60)}ćuti?`;
    const raw = JSON.stringify({ summary: ["Marko ćuti.", "Kod kuće je.", "Pismo nije otvoreno."], openQuestion: long });
    const result = parseSparkResponse("resume", raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.openQuestion.length).toBeLessThanOrEqual(220);
    expect(result.data.openQuestion).toMatch(/Marko…$/);
  });

  it("clips resume summary lines to 160 characters", () => {
    const line = "Marko je otišao iz grada. ".repeat(10);
    const raw = JSON.stringify({ summary: [line, "Kod kuće je.", "Pismo nije otvoreno."], openQuestion: "Ko je poslao pismo?" });
    const result = parseSparkResponse("resume", raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.summary[0]!.length).toBeLessThanOrEqual(160);
  });

  it("rejects a ghost item over 80 characters instead of clipping it", () => {
    const long = { items: [...validGhost.items.slice(0, 2), { kind: "shift", text: "a".repeat(81) }] };
    expect(parseSparkResponse("ghost", JSON.stringify(long))).toEqual({ ok: false, reason: "schema" });
  });

  it("rejects missing fields and unknown kinds", () => {
    expect(parseSparkResponse("resume", JSON.stringify({ summary: ["Nema mirisa."] })).ok).toBe(false);
    const badKind = { items: validGhost.items.map((item) => ({ ...item, kind: "other" })) };
    expect(parseSparkResponse("ghost", JSON.stringify(badKind)).ok).toBe(false);
  });
});

describe("SparkRequestSchema", () => {
  const request = { mode: "ghost", context: "Petar je", bookTitle: "", chapterTitle: "" };

  it("accepts a known language and requests without one", () => {
    expect(SparkRequestSchema.safeParse({ ...request, language: "sr-Latn" }).success).toBe(true);
    expect(SparkRequestSchema.safeParse(request).success).toBe(true);
  });

  it("rejects the removed palette modes", () => {
    for (const mode of ["push", "complicate", "missing"]) {
      expect(SparkRequestSchema.safeParse({ ...request, mode }).success).toBe(false);
    }
  });

  it("rejects an unknown language", () => {
    expect(SparkRequestSchema.safeParse({ ...request, language: "xx" }).success).toBe(false);
  });
});
