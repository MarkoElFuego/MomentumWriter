import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLanguage } from "@/lib/languages";
import { ProofreadRequestSchema, runProofread, type ProofreadRequest } from "./proofread";
import type { Completer } from "./spark";

const request: ProofreadRequest = { mode: "proofread", text: "Cekao sam je ispred skole." };

function completer(reply: string | Error) {
  return vi.fn<Completer>(async () => {
    if (reply instanceof Error) throw reply;
    return reply;
  });
}

const neverAborted = () => new AbortController().signal;

describe("runProofread", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("sends the paragraph with the language's proofreader prompt", async () => {
    const complete = completer("Čekao sam je ispred škole.");
    const result = await runProofread(request, complete, neverAborted());
    expect(result).toEqual({ ok: true, data: { corrected: "Čekao sam je ispred škole." } });
    expect(complete).toHaveBeenCalledOnce();
    expect(complete.mock.calls[0]![0]).toMatchObject({
      mode: "proofread",
      system: getLanguage("sr-Latn").prompts.proofreader,
      user: request.text,
    });
  });

  it("strips fences and quotes the model wrapped around the reply", async () => {
    const result = await runProofread(request, completer("```\n„Čekao sam je ispred škole.”\n```"), neverAborted());
    expect(result).toEqual({ ok: true, data: { corrected: "Čekao sam je ispred škole." } });
  });

  it("keeps quotes the author wrote", async () => {
    const quoted = { ...request, text: "„Cekaj me“, rekla je." };
    const result = await runProofread(quoted, completer("„Čekaj me“, rekla je."), neverAborted());
    expect(result).toEqual({ ok: true, data: { corrected: "„Čekaj me“, rekla je." } });
  });

  it("rejects a reply that retells the paragraph", async () => {
    const result = await runProofread(
      request,
      completer("Stajao je satima pred zgradom i nadao se da će doći."),
      neverAborted(),
    );
    expect(result).toEqual({ ok: false, error: "unavailable" });
  });

  it("makes a single attempt and reports errors", async () => {
    const complete = completer(new Error("boom"));
    expect(await runProofread(request, complete, neverAborted())).toEqual({ ok: false, error: "unavailable" });
    expect(complete).toHaveBeenCalledOnce();
  });

  it("reports a timeout when the deadline passed", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await runProofread(request, completer(new Error("aborted")), controller.signal);
    expect(result).toEqual({ ok: false, error: "timeout" });
  });
});

describe("ProofreadRequestSchema", () => {
  it("accepts one paragraph and refuses an overlong one", () => {
    expect(ProofreadRequestSchema.safeParse(request).success).toBe(true);
    const long = { ...request, text: Array.from({ length: 401 }, () => "reč").join(" ") };
    expect(ProofreadRequestSchema.safeParse(long).success).toBe(false);
    expect(ProofreadRequestSchema.safeParse({ ...request, mode: "push" }).success).toBe(false);
  });
});
