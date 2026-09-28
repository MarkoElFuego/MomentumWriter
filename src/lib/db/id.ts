import type { ID } from "./schema";

// crypto.randomUUID exists only in secure contexts; opening the dev server
// over a LAN IP (e.g. from a phone) is not one, so fall back to getRandomValues.
export function newId(): ID {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
