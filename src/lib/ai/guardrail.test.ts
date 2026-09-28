import { describe, expect, it } from "vitest";
import { checkGuardrail } from "./guardrail";
import type { SparkResponse } from "./schemas";

const context =
  "Kiša je padala celu noć. Petar je stajao na pragu i gledao u mračno dvorište iza stare kuće.";

const push = (text: string): SparkResponse<"push"> => ({
  items: [
    { kind: "inner", text: "Čega se Petar plaši u tom dvorištu?" },
    { kind: "outer", text },
    { kind: "shift", text: "Šta Petar čuje pre nego što vidi?" },
  ],
});

describe("checkGuardrail", () => {
  it("accepts short questions that use names from the context", () => {
    expect(checkGuardrail(push("Šta ako se u dvorištu upali svetlo?"), context)).toEqual({ ok: true });
  });

  it("rejects an item that is dialogue", () => {
    expect(checkGuardrail(push("„Ne diraj to”, rekao je Petar."), context)).toEqual({
      ok: false,
      reason: "dialogue",
    });
    expect(checkGuardrail(push("— Ko je tamo? — viknuo je."), context).ok).toBe(false);
  });

  it("rejects an item that repeats the last sentence of the context", () => {
    const copy = "Petar je stajao na pragu i gledao u mračno dvorište iza stare kuće.";
    expect(checkGuardrail(push(copy), context)).toEqual({ ok: false, reason: "copies-context" });
  });

  it("ignores case and punctuation when looking for copied text", () => {
    const copy = "PETAR je stajao, na pragu — i gledao u mračno dvorište!";
    expect(checkGuardrail(push(copy), context).ok).toBe(false);
  });

  it("allows a short quote of fewer than 8 words from the context", () => {
    expect(checkGuardrail(push("Zašto baš „stajao na pragu”, a ne ušao?"), context).ok).toBe(true);
  });

  it("rejects items with more than 2 sentences", () => {
    const prose = "Vrata su se otvorila. Ušla je žena. Nosila je kofer.";
    expect(checkGuardrail(push(prose), context)).toEqual({ ok: false, reason: "too-long" });
  });

  it("checks every field of missing and resume replies", () => {
    const missing: SparkResponse<"missing"> = {
      observation: "Nedostaje zvuk kiše.",
      question: "„Čuješ li to?”, pitala je.",
    };
    expect(checkGuardrail(missing, context).ok).toBe(false);

    const resume: SparkResponse<"resume"> = {
      summary: ["Petar je izašao napolje.", "Stoji na pragu.", "Ne zna ko je u dvorištu."],
      openQuestion: "Šta ga je izvuklo iz kuće?",
    };
    expect(checkGuardrail(resume, context).ok).toBe(true);
  });
});
