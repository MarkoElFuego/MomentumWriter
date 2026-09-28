import { describe, expect, it } from "vitest";
import { checkGuardrail } from "./guardrail";
import type { SparkResponse } from "./schemas";

const context =
  "Kiša je padala celu noć. Petar je stajao na pragu i gledao u mračno dvorište iza stare kuće.";

const push = (text: string): SparkResponse<"push"> => ({
  items: [
    { kind: "inner", text: "a onda se setio" },
    { kind: "outer", text },
    { kind: "shift", text: "Iza njega, u kuhinji," },
  ],
});

const question = (text: string): SparkResponse<"complicate"> => ({ question: text });

describe("checkGuardrail — push starters", () => {
  it("accepts three short unfinished starters", () => {
    expect(checkGuardrail("push", push("kad je neko pokucao"), context)).toEqual({ ok: true });
  });

  it("allows a starter that opens dialogue", () => {
    expect(checkGuardrail("push", push("— Ko je tamo,"), context).ok).toBe(true);
  });

  it("rejects a starter longer than 5 words", () => {
    expect(checkGuardrail("push", push("kad je neko tiho pokucao na vrata"), context)).toEqual({
      ok: false,
      reason: "starter-too-long",
    });
  });

  it("rejects a starter that is a finished sentence", () => {
    expect(checkGuardrail("push", push("Vrata su se otvorila."), context)).toEqual({
      ok: false,
      reason: "starter-complete",
    });
    expect(checkGuardrail("push", push("Ko je to bio?”"), context).ok).toBe(false);
  });

  it("rejects a starter spanning lines", () => {
    expect(checkGuardrail("push", push("i onda\nnista"), context).ok).toBe(false);
  });
});

describe("checkGuardrail — push finishing an open sentence", () => {
  const open = "Cesto mu je ponavljala da su to mali iznosi ali";
  const finish = (text: string): SparkResponse<"push"> => ({
    items: [
      { kind: "finish", text: "nakupi se do velikog iznosa." },
      { kind: "finish", text },
      { kind: "finish", text: "na kraju godine to je plata" },
    ],
  });

  it("accepts short finishes, including ones that close the sentence", () => {
    expect(checkGuardrail("push", finish("kad se saberu, nije malo."), open)).toEqual({ ok: true });
  });

  it("rejects a finish longer than 8 words", () => {
    expect(checkGuardrail("push", finish("kad se sve to sabere na kraju svake godine"), open)).toEqual({
      ok: false,
      reason: "finish-too-long",
    });
  });

  it("rejects a finish that goes on into a new sentence", () => {
    expect(checkGuardrail("push", finish("nakupi se. Onda je cutala."), open)).toEqual({
      ok: false,
      reason: "finish-new-sentence",
    });
  });
});

describe("checkGuardrail — editorial modes", () => {
  it("accepts short questions that use names from the context", () => {
    expect(checkGuardrail("complicate", question("Šta ako se u dvorištu upali svetlo?"), context)).toEqual({
      ok: true,
    });
  });

  it("rejects an item that is dialogue", () => {
    expect(checkGuardrail("complicate", question("„Ne diraj to”, rekao je Petar."), context)).toEqual({
      ok: false,
      reason: "dialogue",
    });
    expect(checkGuardrail("complicate", question("— Ko je tamo? — viknuo je."), context).ok).toBe(false);
  });

  it("rejects an item that repeats the last sentence of the context", () => {
    const copy = "Petar je stajao na pragu i gledao u mračno dvorište iza stare kuće.";
    expect(checkGuardrail("complicate", question(copy), context)).toEqual({
      ok: false,
      reason: "copies-context",
    });
  });

  it("ignores case and punctuation when looking for copied text", () => {
    const copy = "PETAR je stajao, na pragu — i gledao u mračno dvorište!";
    expect(checkGuardrail("complicate", question(copy), context).ok).toBe(false);
  });

  it("allows a short quote of fewer than 8 words from the context", () => {
    expect(checkGuardrail("complicate", question("Zašto baš „stajao na pragu”, a ne ušao?"), context).ok).toBe(
      true,
    );
  });

  it("rejects items with more than 2 sentences", () => {
    const prose = "Vrata su se otvorila. Ušla je žena. Nosila je kofer.";
    expect(checkGuardrail("complicate", question(prose), context)).toEqual({ ok: false, reason: "too-long" });
  });

  it("checks every field of missing and resume replies", () => {
    const missing: SparkResponse<"missing"> = {
      observation: "Nedostaje zvuk kiše.",
      question: "„Čuješ li to?”, pitala je.",
    };
    expect(checkGuardrail("missing", missing, context).ok).toBe(false);

    const resume: SparkResponse<"resume"> = {
      summary: ["Petar je izašao napolje.", "Stoji na pragu.", "Ne zna ko je u dvorištu."],
      openQuestion: "Šta ga je izvuklo iz kuće?",
    };
    expect(checkGuardrail("resume", resume, context).ok).toBe(true);
  });
});
