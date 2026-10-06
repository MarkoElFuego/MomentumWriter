import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildMemoryMessage, isExactQuote, MemoryRequestSchema, parseMemoryReply, runMemory, type MemoryRequest } from "./memory";
import { buildRequestParams } from "./requestParams";
import type { Completer } from "./spark";

const chapter =
  "Kiša je padala celu noć. Petar je stajao na pragu.\n\nMara je ćutala. Kofer je ostao kod nje, zaključan, kao da čeka nekoga drugog.";

const request: MemoryRequest = {
  mode: "memory",
  text: chapter,
  memory: { characters: ["Petar — dolazi u selo"], places: [], openThreads: ["Ko je poslao pismo?"] },
  pinned: { characters: ["Mara — Petrova sestra"], places: ["Stara kuća"], openThreads: [] },
  bookTitle: "Kiša",
  chapterTitle: "Poglavlje I · Dolazak",
  genre: "misterija",
};

const reply = (change: Record<string, unknown> = {}) =>
  JSON.stringify({
    characters: ["Petar — dolazi u selo, čeka na pragu"],
    places: ["Dvorište"],
    openThreads: ["Šta je u koferu?"],
    summary: "Petar je stigao po kiši. Mara je ćutala, a kofer je ostao kod nje.",
    bestLine: "Kofer je ostao kod nje, zaključan, kao da čeka nekoga drugog.",
    ...change,
  });

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("memory — request", () => {
  it("accepts a chapter with the memory and the author's lines", () => {
    expect(MemoryRequestSchema.safeParse(request).success).toBe(true);
  });

  it("rejects lists longer than 12 and lines longer than 80 characters", () => {
    const many = Array.from({ length: 13 }, (_, i) => `Lik ${i}`);
    expect(MemoryRequestSchema.safeParse({ ...request, memory: { ...request.memory, characters: many } }).success).toBe(false);
    expect(
      MemoryRequestSchema.safeParse({ ...request, pinned: { ...request.pinned, places: ["a".repeat(81)] } }).success,
    ).toBe(false);
  });

  it("puts the memory, the author's lines and the chapter in that order", () => {
    const message = buildMemoryMessage(request);
    expect(message.startsWith("Knjiga: Kiša\nŽanr: misterija\nPoglavlje: Poglavlje I · Dolazak")).toBe(true);
    const memory = message.indexOf("---TRENUTNA MEMORIJA---");
    const pinned = message.indexOf("---AUTOR UPISAO---");
    const text = message.indexOf("---POGLAVLJE---");
    expect(memory).toBeLessThan(pinned);
    expect(pinned).toBeLessThan(text);
    expect(message).toContain("Likovi:\n- Mara — Petrova sestra");
    expect(message).toContain("Mesta:\n- (ništa)");
    expect(message.endsWith(chapter)).toBe(true);
  });

  it("goes out with effort medium and no temperature", () => {
    const params = buildRequestParams({ model: "m", system: "s", user: "u", maxCompletionTokens: 4000, effort: "medium", temperature: 0.5 });
    expect(params.reasoning_effort).toBe("medium");
    expect(params).not.toHaveProperty("temperature");
  });
});

describe("memory — reply", () => {
  it("keeps lists, summary and an exact best line", () => {
    const parsed = parseMemoryReply(reply(), chapter);
    expect(parsed).toEqual({
      ok: true,
      data: {
        characters: ["Petar — dolazi u selo, čeka na pragu"],
        places: ["Dvorište"],
        openThreads: ["Šta je u koferu?"],
        summary: "Petar je stigao po kiši. Mara je ćutala, a kofer je ostao kod nje.",
        bestLine: "Kofer je ostao kod nje, zaključan, kao da čeka nekoga drugog.",
      },
    });
  });

  it("drops a best line that is not word for word in the chapter, keeps the rest", () => {
    for (const bestLine of [
      "Kofer je ostao kod nje, zaključan, kao da čeka nekog drugog.",
      "„Kofer je ostao kod nje, zaključan, kao da čeka nekoga drugog.”",
      "Rečenica koje nema.",
    ]) {
      const parsed = parseMemoryReply(reply({ bestLine }), chapter);
      expect(parsed.ok && parsed.data.bestLine).toBe(undefined);
      expect(parsed.ok && parsed.data.summary).toContain("Petar");
    }
  });

  it("allows only different spaces and line breaks in the quote", () => {
    expect(isExactQuote("Petar je stajao\nna pragu.", chapter)).toBe(true);
    expect(isExactQuote("petar je stajao na pragu.", chapter)).toBe(false);
    expect(isExactQuote("  ", chapter)).toBe(false);
  });

  it("an empty best line is no best line", () => {
    const parsed = parseMemoryReply(reply({ bestLine: "" }), chapter);
    expect(parsed.ok && "bestLine" in parsed.data).toBe(false);
  });

  it("clips long lines and drops extra ones instead of losing the chapter", () => {
    const many = Array.from({ length: 15 }, (_, i) => `Lik broj ${i}`);
    const parsed = parseMemoryReply(reply({ characters: [...many, "a ".repeat(60)], places: ["  ", "Selo"] }), chapter);
    expect(parsed.ok && parsed.data.characters).toHaveLength(12);
    expect(parsed.ok && parsed.data.places).toEqual(["Selo"]);
    const long = parseMemoryReply(reply({ openThreads: [`${"reč ".repeat(30)}kraj`] }), chapter);
    expect(long.ok && long.data.openThreads[0]!.length).toBeLessThanOrEqual(80);
  });

  it("rejects invalid JSON and a reply without a summary", () => {
    expect(parseMemoryReply("Evo memorije:", chapter)).toEqual({ ok: false, reason: "invalid-json" });
    expect(parseMemoryReply(reply({ summary: undefined }), chapter)).toEqual({ ok: false, reason: "schema" });
  });
});

describe("memory — one more try", () => {
  it("asks again once, then gives up and the client keeps the old memory", async () => {
    const bad = vi.fn<Completer>(async () => "nije JSON");
    expect(await runMemory(request, bad, new AbortController().signal)).toEqual({ ok: false, error: "unavailable" });
    expect(bad).toHaveBeenCalledTimes(2);

    const replies = ["nije JSON", reply()];
    const second = vi.fn<Completer>(async () => replies.shift() ?? "");
    const result = await runMemory(request, second, new AbortController().signal);
    expect(result.ok).toBe(true);
    expect(second).toHaveBeenCalledTimes(2);
    expect(second.mock.calls[0]![0].mode).toBe("memory");
  });
});
