// Browser side of /api/spark. Types only from lib/ai — never the SDK or the key.
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
