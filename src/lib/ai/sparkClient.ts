// Browser side of /api/spark. Types only from lib/ai — never the SDK or the key.
import type { MemoryRequest, MemoryResult } from "./memory";
import type { ProofreadRequest } from "./proofread";
import type { SparkRequest, SparkResponse } from "./schemas";

export type SparkClientError = "offline" | "timeout" | "unavailable";
export type SparkClientResult =
  | { ok: true; data: SparkResponse }
  | { ok: false; error: SparkClientError };

// Backstop only: the server gives up at 15 s and answers 504 on its own.
const CLIENT_TIMEOUT_MS = 20_000;

export async function requestSpark(body: SparkRequest, signal: AbortSignal): Promise<SparkClientResult> {
  const timeout = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  try {
    const response = await fetch("/api/spark", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, timeout]),
    });
    if (response.status === 504) return { ok: false, error: "timeout" };
    if (!response.ok) return { ok: false, error: "unavailable" };
    const { data } = (await response.json()) as { data: SparkResponse };
    return { ok: true, data };
  } catch {
    if (timeout.aborted) return { ok: false, error: "timeout" };
    return { ok: false, error: navigator.onLine ? "unavailable" : "offline" };
  }
}

/**
 * One paragraph → the corrected paragraph. Failures are silent (no underlines);
 * `retry` is false when the server rejected this text — sending it again would
 * get the same answer and cost the same.
 */
export type ProofreadClientResult = { ok: true; corrected: string } | { ok: false; retry: boolean };

export async function requestProofread(body: ProofreadRequest, signal: AbortSignal): Promise<ProofreadClientResult> {
  try {
    const response = await fetch("/api/spark", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(CLIENT_TIMEOUT_MS)]),
    });
    if (!response.ok) return { ok: false, retry: response.status !== 502 && response.status !== 400 };
    const { data } = (await response.json()) as { data: { corrected: string } };
    return { ok: true, corrected: data.corrected };
  } catch {
    return { ok: false, retry: true };
  }
}

// Memory reads a whole chapter with medium reasoning; the server gives up at 45 s.
const MEMORY_CLIENT_TIMEOUT_MS = 50_000;

/** Background read of one chapter (T2). Any failure keeps the old memory — the caller only logs it. */
export async function requestMemory(
  body: MemoryRequest,
): Promise<{ ok: true; data: MemoryResult } | { ok: false; status: number | "network" }> {
  try {
    const response = await fetch("/api/spark", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(MEMORY_CLIENT_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, status: response.status };
    const { data } = (await response.json()) as { data: MemoryResult };
    return { ok: true, data };
  } catch {
    return { ok: false, status: "network" };
  }
}
