import { describe, expect, it } from "vitest";
import { checkGuardrail } from "./guardrail";
import type { SparkResponse } from "./schemas";

const context =
  "Kiša je padala celu noć. Petar je stajao na pragu i gledao u mračno dvorište iza stare kuće.";

type Items = SparkResponse<"push">["items"];
const starters = (...texts: string[]): SparkResponse<"push"> => ({
  items: texts.map((text, i) => ({ kind: (["inner", "outer", "shift"] as const)[i]!, text })),
});
const finishes = (...texts: string[]): SparkResponse<"push"> => ({
  items: texts.map((text) => ({ kind: "finish" as const, text })),
});
const kept = (result: ReturnType<typeof checkGuardrail>): string[] =>
  result.ok && "items" in result.data ? (result.data.items as Items).map((item) => item.text) : [];

const question = (text: string): SparkResponse<"complicate"> => ({ question: text });

describe("checkGuardrail — push starters (after a full stop)", () => {
  it("keeps three short unfinished starters", () => {
    const result = checkGuardrail("push", starters("a onda se setio", "kad je neko pokucao", "Iza njega, u kuhinji,"), context);
    expect(kept(result)).toEqual(["a onda se setio", "kad je neko pokucao", "Iza njega, u kuhinji,"]);
  });

  it("allows a starter that opens dialogue", () => {
    expect(kept(checkGuardrail("push", starters("— Ko je tamo,"), context))).toEqual(["— Ko je tamo,"]);
  });

  it("drops only the bad starters and keeps the rest", () => {
    const result = checkGuardrail(
      "push",
      starters("kad je neko tiho pokucao na vrata", "Vrata su se otvorila.", "a onda se setio"),
      context,
    );
    expect(kept(result)).toEqual(["a onda se setio"]);
  });

  it("rejects the reply when no starter survives, with the first reason", () => {
    expect(checkGuardrail("push", starters("kad je neko tiho pokucao na vrata", "i onda\nnista"), context)).toEqual({
      ok: false,
      reason: "starter-too-long",
    });
    expect(checkGuardrail("push", starters("Ko je to bio?”"), context)).toEqual({
      ok: false,
      reason: "starter-complete",
    });
  });

  it("drops duplicate suggestions", () => {
    expect(kept(checkGuardrail("push", starters("a onda", "a onda", "kad je"), context))).toEqual(["a onda", "kad je"]);
  });
});

describe("checkGuardrail — finishing an open sentence (push and ghost)", () => {
  const open = "Cesto mu je ponavljala da su to mali iznosi ali";

  it("keeps short finishes, with or without a period", () => {
    const result = checkGuardrail("push", finishes("nakupi se do velikog iznosa.", "kad se saberu", "nije malo."), open);
    expect(kept(result)).toEqual(["nakupi se do velikog iznosa.", "kad se saberu", "nije malo."]);
  });

  it("allows 7 words and drops 8", () => {
    const seven = "kad se sve sabere na kraju godine";
    const eight = "kad se sve to sabere na kraju godine";
    expect(kept(checkGuardrail("ghost", finishes(seven, eight), open))).toEqual([seven]);
  });

  it("drops a finish that goes on into a new sentence", () => {
    expect(checkGuardrail("ghost", finishes("nakupi se. Onda je cutala."), open)).toEqual({
      ok: false,
      reason: "finish-new-sentence",
    });
  });

  it("ghost after a full stop follows the starter rules", () => {
    const result = checkGuardrail("ghost", starters("Tada je shvatio", "Vrata su se otvorila.", "Negde u kuci"), context);
    expect(kept(result)).toEqual(["Tada je shvatio", "Negde u kuci"]);
  });

  it("treats a closed quote as the end of a sentence", () => {
    const quoted = "Rekla je: „Idi”";
    expect(kept(checkGuardrail("ghost", starters("Nije se pomerio", "i otisla je."), quoted))).toEqual([
      "Nije se pomerio",
    ]);
  });
});

describe("checkGuardrail — editorial modes", () => {
  it("accepts short questions that use names from the context", () => {
    const data = question("Šta ako se u dvorištu upali svetlo?");
    expect(checkGuardrail("complicate", data, context)).toEqual({ ok: true, data });
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
    expect(checkGuardrail("complicate", question("Zašto baš „stajao na pragu”, a ne ušao?"), context).ok).toBe(true);
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
