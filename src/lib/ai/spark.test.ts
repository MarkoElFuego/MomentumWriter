import { beforeEach, describe, expect, it, vi } from "vitest";
import { countWords } from "@/lib/text/countWords";
import type { SparkRequest } from "./schemas";
import { runSpark, type Completer } from "./spark";

const request: SparkRequest = {
  mode: "resume",
  context: "Petar je stajao na pragu i gledao u mračno dvorište.",
  bookTitle: "Kiša",
  chapterTitle: "Poglavlje I",
};

const summary = ["Petar je došao kući.", "Stoji na pragu.", "Ne zna ko je u dvorištu."];
const good = JSON.stringify({ summary, openQuestion: "Šta ako Petar ne sme da uđe u kuću?" });

// Returns the given replies in order; an Error entry is thrown instead.
function completer(...replies: (string | Error)[]) {
  return vi.fn<Completer>(async () => {
    const reply = replies.shift();
    if (reply instanceof Error) throw reply;
    return reply ?? "";
  });
}

const neverAborted = () => new AbortController().signal;

describe("runSpark", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("returns parsed data from the first good reply", async () => {
    const complete = completer(good);
    const result = await runSpark(request, complete, neverAborted());
    expect(result).toEqual({ ok: true, data: { summary, openQuestion: "Šta ako Petar ne sme da uđe u kuću?" } });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("retries once after invalid JSON", async () => {
    const complete = completer("nije json", good);
    expect((await runSpark(request, complete, neverAborted())).ok).toBe(true);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("retries once when the guardrail rejects prose", async () => {
    const complete = completer(JSON.stringify({ summary, openQuestion: "„Ne diraj to”, rekao je Petar." }), good);
    expect((await runSpark(request, complete, neverAborted())).ok).toBe(true);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("retries once after a request error", async () => {
    const complete = completer(new Error("network"), good);
    expect((await runSpark(request, complete, neverAborted())).ok).toBe(true);
  });

  it("gives up as unavailable after two bad replies", async () => {
    const complete = completer("loše", "opet loše", good);
    expect(await runSpark(request, complete, neverAborted())).toEqual({ ok: false, error: "unavailable" });
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("reports a timeout without retrying", async () => {
    const controller = new AbortController();
    const complete = vi.fn<Completer>(async () => {
      controller.abort();
      throw new Error("aborted");
    });
    expect(await runSpark(request, complete, controller.signal)).toEqual({ ok: false, error: "timeout" });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("tells the ghost model when the cursor is mid-sentence", async () => {
    const finishes = JSON.stringify({
      items: [
        { kind: "finish", text: "nakupi se do velikog iznosa." },
        { kind: "finish", text: "na kraju je to plata." },
        { kind: "finish", text: "nisu mali kad se saberu." },
      ],
    });
    const complete = completer(finishes);
    const open = { ...request, mode: "ghost" as const, context: "Kisa je stala. Govorila je da su to mali iznosi ali" };
    expect((await runSpark(open, complete, neverAborted(), { attempts: 1 })).ok).toBe(true);
    const user = complete.mock.calls[0]![0].user;
    expect(user).toContain(
      "---KURSOR---\nUSRED rečenice. Nedovršena rečenica: „Govorila je da su to mali iznosi ali”",
    );
  });

  it("tells the ghost model when the cursor is after a finished sentence", async () => {
    const starters = JSON.stringify({
      items: [
        { kind: "inner", text: "Tada je shvatio" },
        { kind: "outer", text: "Neko je pokucao" },
        { kind: "shift", text: "Napolju je kisa" },
      ],
    });
    const complete = completer(starters);
    const after = { ...request, mode: "ghost" as const, context: "Platio je domen i godisnji hosting." };
    const result = await runSpark(after, complete, neverAborted(), { attempts: 1 });
    expect(result.ok).toBe(true);
    expect(complete.mock.calls[0]![0].user).toContain("---KURSOR---\nPOSLE završene rečenice");
  });

  it("makes a single attempt when asked to (ghost)", async () => {
    const complete = completer("loše", good);
    const result = await runSpark(request, complete, neverAborted(), { attempts: 1 });
    expect(result).toEqual({ ok: false, error: "unavailable" });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("trims the context to maxWords before sending", async () => {
    const complete = completer(good);
    const long = { ...request, context: `${"Staro. ".repeat(50)}\n\nPetar čeka.` };
    await runSpark(long, complete, neverAborted(), { maxWords: 5 });
    const user = complete.mock.calls[0]![0].user;
    const sent = user.split("---TEKST---\n")[1]!;
    expect(countWords(sent)).toBeLessThanOrEqual(5);
    expect(sent.endsWith("Petar čeka.")).toBe(true);
  });
});
