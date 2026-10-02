import { PROOF_CACHE_VERSION } from "@/lib/ai/proofread";
import type { Language } from "@/lib/languages";
import { hashText } from "@/lib/text/hash";
import { db, type ProofCacheEntry, type RejectedEdit } from "./schema";

const UNUSED_FOR_MS = 90 * 24 * 60 * 60 * 1000;

export function proofCacheKey(language: Language, text: string): string {
  return `${PROOF_CACHE_VERSION}:${language}:${hashText(text)}`;
}

export interface ProofResult {
  /** null = the server rejected this paragraph — don't send it again. */
  corrected: string | null;
  rejected: RejectedEdit[];
}

/** The saved check of exactly this paragraph text; a hit counts as a use. */
export async function getProofResult(
  language: Language,
  text: string,
  now = Date.now(),
): Promise<ProofResult | undefined> {
  const key = proofCacheKey(language, text);
  const entry = await db.proofCache.get(key);
  // Same hash, different text: a collision, not this paragraph.
  if (!entry || entry.text !== text) return undefined;
  await db.proofCache.update(key, { usedAt: now });
  return { corrected: entry.corrected, rejected: entry.rejected };
}

export async function saveProofResult(
  language: Language,
  text: string,
  result: ProofResult,
  now = Date.now(),
): Promise<void> {
  const key = proofCacheKey(language, text);
  const previous = await db.proofCache.get(key);
  const entry: ProofCacheEntry = {
    key,
    text,
    corrected: result.corrected,
    rejected: result.rejected,
    createdAt: previous?.text === text ? previous.createdAt : now,
    usedAt: now,
  };
  await db.proofCache.put(entry);
}

/** On start: checks nobody has opened for 90 days (by last use, not creation). */
export async function purgeProofCache(now = Date.now()): Promise<number> {
  return db.proofCache.where("usedAt").below(now - UNUSED_FOR_MS).delete();
}
