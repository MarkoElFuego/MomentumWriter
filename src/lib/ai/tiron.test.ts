import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRequestParams } from "./requestParams";
import type { Completer } from "./spark";
import {
  buildTironMessage,
  parseWinReply,
  parseWhisperReply,
  runTiron,
  TironRequestSchema,
  whisperProblem,
  winProblem,
  type TironRequest,
} from "./tiron";

const reply = (change: Record<string, unknown> = {}) => JSON.stringify({ whisper: "Mara još čuva kofer — šta će Petar reći kad ga vidi?", kind: "story", ...change });
const bestLines = ["Kofer je ostao kod nje, zaključan, kao da čeka nekoga drugog."];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("tiron — request", () => {
  const base: TironRequest = { mode: "tiron", moment: "entry", bookTitle: "Kiša" };

  it("accepts every moment and pattern, rejects unknown ones", () => {
    for (const moment of ["entry", "pattern", "chapterEnd", "sessionEnd"]) {
      expect(TironRequestSchema.safeParse({ ...base, moment }).success).toBe(true);
    }
    expect(TironRequestSchema.safeParse({ ...base, moment: "always" }).success).toBe(false);
    expect(TironRequestSchema.safeParse({ ...base, moment: "pattern", pattern: "nearEnd" }).success).toBe(true);
    expect(TironRequestSchema.safeParse({ ...base, moment: "pattern", pattern: "nag" }).success).toBe(false);
  });

  it("keeps the context within limits", () => {
    expect(TironRequestSchema.safeParse({ ...base, previous: ["a", "b", "c", "d", "e", "f"] }).success).toBe(false);
    expect(TironRequestSchema.safeParse({ ...base, memory: "x".repeat(1501) }).success).toBe(false);
  });

  it("sends only the parts that have something in them", () => {
    expect(buildTironMessage(base)).toBe("Knjiga: Kiša\n\n---TRENUTAK---\nentry");
    const full = buildTironMessage({
      ...base,
      moment: "pattern",
      pattern: "middleSlump",
      heart: { about: "O kiši.", why: "Zbog bake." },
      memory: "Likovi: Mara — sestra",
      summaries: [{ label: "I · Dolazak", summary: "Petar je stigao." }],
      signals: {
        daysSinceLastSession: 2,
        sessionsLast7Days: 3,
        rewriteRatio: 0.25,
        restartsOfCurrentPart: 1,
        bookPosition: "sredina",
        typicalHour: 21,
        trend: "pad",
      },
      text: "Kiša je padala.",
      bestLines,
      previous: ["Dobrodošao nazad u kišu."],
    });
    for (const section of [
      "---OBRAZAC---\nmiddleSlump",
      "---SRCE KNJIGE---\nO čemu je: O kiši.\nZašto je piše: Zbog bake.",
      "---ŠTA TIRON PAMTI---\nLikovi: Mara — sestra",
      "---SAŽECI---\nI · Dolazak: Petar je stigao.",
      "Udeo obrisanih reči u poslednje 3 sesije: 25%",
      "Mesto u knjizi: sredina",
      "Dužina sesija: u padu",
      "---TEKST---\nKiša je padala.",
      `---NAJJAČE REČENICE---\n- ${bestLines[0]}`,
      "---PRETHODNI ŠAPATI---\n- Dobrodošao nazad u kišu.",
    ]) {
      expect(full).toContain(section);
    }
    expect(full).not.toContain("Kako se završava");
  });

  it("goes out without temperature (effort medium, low for the end of a session)", () => {
    const params = buildRequestParams({ model: "m", system: "s", user: "u", maxCompletionTokens: 1200, effort: "medium", temperature: 0.7 });
    expect(params).not.toHaveProperty("temperature");
  });
});

describe("tiron — guardrail", () => {
  it("keeps a short, warm whisper", () => {
    expect(whisperProblem("Mara još čuva kofer. Šta će Petar reći kad ga vidi?")).toBeNull();
  });

  it("rejects dialogue, three sentences, over 220 characters", () => {
    expect(whisperProblem("— Dolazim, rekla je Mara.")).toBe("dialogue");
    expect(whisperProblem("„Kofer” čeka.")).toBe("dialogue");
    expect(whisperProblem("Kiša pada. Petar čeka. Šta sada?")).toBe("too-long");
    expect(whisperProblem(`${"a".repeat(220)}`)).toBeNull();
    expect(whisperProblem(`${"a".repeat(221)}`)).toBe("whisper-too-long");
  });

  it("rejects a verdict on the draft and „trebalo bi”", () => {
    expect(whisperProblem("Ova scena je dosadna, probaj drugačije.")).toBe("judgment");
    expect(whisperProblem("Početak je slab.")).toBe("judgment");
    expect(whisperProblem("Dijalog ti je loš.")).toBe("judgment");
    expect(whisperProblem("Ovo je greška u pisanju.")).toBe("judgment");
    expect(whisperProblem("Trebalo bi da skratiš uvod.")).toBe("judgment");
    // Not whole words: "slabost", "dosadilo" are not verdicts on the text.
    expect(whisperProblem("Petrova slabost je kofer?")).toBeNull();
  });
});

describe("tiron — reply", () => {
  it("keeps a quote that is one of the best lines, as saved", () => {
    const parsed = parseWhisperReply(reply({ kind: "why", quote: ` ${bestLines[0]} ` }), bestLines);
    expect(parsed).toEqual({ ok: true, data: { whisper: expect.any(String), kind: "why", quote: bestLines[0] } });
  });

  it("drops a quote that isn't one of them, keeps the whisper", () => {
    const parsed = parseWhisperReply(reply({ quote: "Rečenica koje nema." }), bestLines);
    expect(parsed.ok && "quote" in parsed.data).toBe(false);
    expect(parsed.ok && parsed.data.whisper).toContain("Mara");
  });

  it("rejects invalid JSON, an unknown kind and a bad whisper", () => {
    expect(parseWhisperReply("Evo:", bestLines)).toEqual({ ok: false, reason: "invalid-json" });
    expect(parseWhisperReply(reply({ kind: "grade" }), bestLines)).toEqual({ ok: false, reason: "schema" });
    expect(parseWhisperReply(reply({ whisper: "Ovo je dosadno." }), bestLines)).toEqual({ ok: false, reason: "judgment" });
  });
});

describe("tiron — one more try", () => {
  it("asks again once and passes the moment along", async () => {
    const replies = [reply({ whisper: "Ovo je dosadno." }), reply()];
    const complete = vi.fn<Completer>(async () => replies.shift() ?? "");
    const result = await runTiron({ mode: "tiron", moment: "chapterEnd", bookTitle: "Kiša" }, complete, new AbortController().signal);
    expect(result.ok).toBe(true);
    expect(complete).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls[0]![0]).toMatchObject({ mode: "tiron", moment: "chapterEnd" });
    expect(complete.mock.calls[0]![0].system.startsWith("Ti si Tiron")).toBe(true);
  });

  it("gives up after two bad replies", async () => {
    const complete = vi.fn<Completer>(async () => "nije JSON");
    expect(await runTiron({ mode: "tiron", moment: "entry", bookTitle: "Kiša" }, complete, new AbortController().signal)).toEqual({
      ok: false,
      error: "unavailable",
    });
  });
});

describe("tiron — small win at the end of a session (T6)", () => {
  const win = (change: Record<string, unknown> = {}) =>
    JSON.stringify({ progress: "Petar je ušao u kuću i našao kofer.", tomorrow: "Šta je u koferu?", ...change });

  it("keeps what moved in the story and one question for today", () => {
    expect(parseWinReply(win())).toEqual({
      ok: true,
      data: { progress: "Petar je ušao u kuću i našao kofer.", tomorrow: "Šta je u koferu?" },
    });
  });

  it("rejects a question without „?”, two sentences, a verdict, dialogue and length", () => {
    const ok = { progress: "Petar je našao kofer.", tomorrow: "Šta je u koferu?" };
    expect(winProblem({ ...ok, tomorrow: "Otvori kofer." })).toBe("win-not-question");
    expect(winProblem({ ...ok, progress: "Petar je stigao. Našao je kofer." })).toBe("win-sentences");
    expect(winProblem({ ...ok, progress: "Scena je bila dosadna." })).toBe("judgment");
    expect(winProblem({ ...ok, progress: "— Stigao sam, rekao je Petar." })).toBe("dialogue");
    expect(winProblem({ ...ok, tomorrow: `${"a".repeat(160)}?` })).toBe("win-too-long");
    expect(winProblem(ok)).toBeNull();
  });

  it("the end of a session asks for a small win, once more if the first is bad", async () => {
    const replies = [win({ tomorrow: "Otvori kofer." }), win()];
    const complete = vi.fn<Completer>(async () => replies.shift() ?? "");
    const result = await runTiron({ mode: "tiron", moment: "sessionEnd", bookTitle: "Kiša" }, complete, new AbortController().signal);
    expect(result).toEqual({ ok: true, data: { progress: "Petar je ušao u kuću i našao kofer.", tomorrow: "Šta je u koferu?" } });
    expect(complete).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls[0]![0]).toMatchObject({ moment: "sessionEnd" });
  });
});
