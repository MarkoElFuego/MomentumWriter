import { describe, expect, it } from "vitest";
import { checkGuardrail } from "./guardrail";
import type { SparkResponse } from "./schemas";

const context =
  "Kiša je padala celu noć. Petar je stajao na pragu i gledao u mračno dvorište iza stare kuće.";

type Items = SparkResponse<"ghost">["items"];
const starters = (...texts: string[]): SparkResponse<"ghost"> => ({
  items: texts.map((text, i) => ({ kind: (["inner", "outer", "shift"] as const)[i]!, text })),
});
const finishes = (...texts: string[]): SparkResponse<"ghost"> => ({
  items: texts.map((text) => ({ kind: "finish" as const, text })),
});
const kept = (result: ReturnType<typeof checkGuardrail>): string[] =>
  result.ok && "items" in result.data ? (result.data.items as Items).map((item) => item.text) : [];

const summary = ["Petar je izašao napolje.", "Stoji na pragu.", "Ne zna ko je u dvorištu."];
const question = (text: string): SparkResponse<"resume"> => ({ summary, openQuestion: text });

describe("checkGuardrail — ghost starters (after a full stop)", () => {
  it("keeps three short unfinished starters", () => {
    const result = checkGuardrail("ghost", starters("a onda se setio", "kad je neko pokucao", "Iza njega, u kuhinji,"), context);
    expect(kept(result)).toEqual(["a onda se setio", "kad je neko pokucao", "Iza njega, u kuhinji,"]);
  });

  it("allows a starter that opens dialogue", () => {
    expect(kept(checkGuardrail("ghost", starters("— Ko je tamo,"), context))).toEqual(["— Ko je tamo,"]);
  });

  it("drops only the bad starters and keeps the rest", () => {
    const result = checkGuardrail(
      "ghost",
      starters("kad je neko tiho pokucao na vrata", "Vrata su se otvorila.", "a onda se setio"),
      context,
    );
    expect(kept(result)).toEqual(["a onda se setio"]);
  });

  it("rejects the reply when no starter survives, with the first reason", () => {
    expect(checkGuardrail("ghost", starters("kad je neko tiho pokucao na vrata", "i onda\nnista"), context)).toEqual({
      ok: false,
      reason: "starter-too-long",
    });
    expect(checkGuardrail("ghost", starters("Ko je to bio?”"), context)).toEqual({
      ok: false,
      reason: "starter-complete",
    });
  });

  it("drops duplicate suggestions", () => {
    expect(kept(checkGuardrail("ghost", starters("a onda", "a onda", "kad je"), context))).toEqual(["a onda", "kad je"]);
  });
});

describe("checkGuardrail — finishing an open sentence (ghost)", () => {
  const open = "Cesto mu je ponavljala da su to mali iznosi ali";

  it("keeps short finishes, with or without a period", () => {
    const result = checkGuardrail("ghost", finishes("nakupi se do velikog iznosa.", "kad se saberu", "nije malo."), open);
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

describe("checkGuardrail — resume and other question modes", () => {
  it("accepts short questions that use names from the context", () => {
    const data = question("Šta ako se u dvorištu upali svetlo?");
    expect(checkGuardrail("resume", data, context)).toEqual({ ok: true, data });
  });

  it("rejects an item that is dialogue", () => {
    expect(checkGuardrail("resume", question("„Ne diraj to”, rekao je Petar."), context)).toEqual({
      ok: false,
      reason: "dialogue",
    });
    expect(checkGuardrail("resume", question("— Ko je tamo? — viknuo je."), context).ok).toBe(false);
  });

  it("rejects an item that repeats the last sentence of the context", () => {
    const copy = "Petar je stajao na pragu i gledao u mračno dvorište iza stare kuće.";
    expect(checkGuardrail("resume", question(copy), context)).toEqual({
      ok: false,
      reason: "copies-context",
    });
  });

  it("ignores case and punctuation when looking for copied text", () => {
    const copy = "PETAR je stajao, na pragu — i gledao u mračno dvorište!";
    expect(checkGuardrail("resume", question(copy), context).ok).toBe(false);
  });

  it("allows a short quote of fewer than 8 words from the context", () => {
    expect(checkGuardrail("resume", question("Zašto baš „stajao na pragu”, a ne ušao?"), context).ok).toBe(true);
  });

  it("rejects items with more than 2 sentences", () => {
    const prose = "Vrata su se otvorila. Ušla je žena. Nosila je kofer.";
    expect(checkGuardrail("resume", question(prose), context)).toEqual({ ok: false, reason: "too-long" });
  });

  it("checks every field of a resume reply", () => {
    expect(checkGuardrail("resume", question("Šta ga je izvuklo iz kuće?"), context).ok).toBe(true);

    const dialogueLine: SparkResponse<"resume"> = {
      summary: ["Petar je izašao napolje.", "„Čuješ li to?”, pitala je.", "Ne zna ko je u dvorištu."],
      openQuestion: "Šta ga je izvuklo iz kuće?",
    };
    expect(checkGuardrail("resume", dialogueLine, context).ok).toBe(false);
  });
});
