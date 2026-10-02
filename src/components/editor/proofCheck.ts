import type { Node as PMNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import type { ProofreadClientResult } from "@/lib/ai/sparkClient";
import type { ProofResult } from "@/lib/db/proofCache";
import type { RejectedEdit } from "@/lib/db/schema";
import { countWords } from "@/lib/text/countWords";
import type { LanguageCounts } from "@/lib/text/languageScore";
import { proofDiff, type DroppedChange, type ProofEdit } from "@/lib/text/proofDiff";
import { paragraphText, proofEventOf, proofMarkCounts } from "./proofMarks";

// The language check of one paragraph, independent of React: where a result
// comes from (memory → saved → API), what is still offered, and how a
// rejection or an acceptance changes the saved result.

/**
 * Text the author can proofread: any paragraph or heading — also inside a quote
 * or a list, which pasted text often lands in — but never a footnote (Faza 4).
 */
export function isCheckable(node: PMNode | null | undefined): node is PMNode {
  return !!node && node.isTextblock && node.type.name !== "footnote";
}

export function forEachCheckable(doc: PMNode, visit: (node: PMNode, pos: number) => void) {
  doc.descendants((node, pos) => {
    if (node.type.name === "footnotes") return false;
    if (isCheckable(node)) {
      visit(node, pos);
      return false;
    }
    return true;
  });
}

const sameEdit = (rejected: RejectedEdit, edit: ProofEdit) =>
  rejected.from === edit.from && rejected.to === edit.to && rejected.start === edit.start;

/** Corrections to underline: the proofreader's, minus the ones the author rejected. */
export function visibleEdits(text: string, result: ProofResult, dropped?: DroppedChange[]): ProofEdit[] {
  if (result.corrected === null) return [];
  return proofDiff(text, result.corrected, dropped).filter(
    (edit) => !result.rejected.some((rejected) => sameEdit(rejected, edit)),
  );
}

export interface ProofSources {
  /** This session's results by paragraph text. */
  memory: Map<string, ProofResult>;
  /** Saved results (Dexie proofCache). */
  lookup: (text: string) => Promise<ProofResult | undefined>;
  save: (text: string, result: ProofResult) => Promise<void>;
  request: (text: string, signal: AbortSignal) => Promise<ProofreadClientResult>;
}

/** Memory or the saved check — no API call. */
export async function knownProof(text: string, sources: ProofSources): Promise<ProofResult | undefined> {
  const known = sources.memory.get(text) ?? (await sources.lookup(text));
  if (known) sources.memory.set(text, known);
  return known;
}

/**
 * A paragraph's result, asking the API only when it isn't known. A rejection
 * by the server is saved too (corrected: null), so it is never sent again;
 * `retry` means a network problem — try again later.
 */
export async function resolveProof(
  text: string,
  sources: ProofSources,
  signal: AbortSignal,
): Promise<{ result: ProofResult; fromApi: boolean } | { retry: true }> {
  const known = await knownProof(text, sources);
  if (known) return { result: known, fromApi: false };
  const reply = await sources.request(text, signal);
  if (!reply.ok && reply.retry) return { retry: true };
  const result: ProofResult = { corrected: reply.ok ? reply.corrected : null, rejected: [] };
  sources.memory.set(text, result);
  await sources.save(text, result);
  return { result, fromApi: true };
}

function blockAt(doc: PMNode, pos: number): { node: PMNode; pos: number } | null {
  const $pos = doc.resolve(pos);
  return $pos.parent.isTextblock ? { node: $pos.parent, pos: $pos.before() } : null;
}

/**
 * How a Prihvati / Odbaci changes the paragraph's saved result:
 * - rejected → same text, one more rejected correction;
 * - accepted → the paragraph's NEW text gets the same proofreader answer, so
 *   the remaining underlines need no new API call; earlier rejections move
 *   with the text.
 */
export function proofChangeFor(
  tr: Transaction,
  lookup: (text: string) => ProofResult | undefined,
): { text: string; result: ProofResult } | null {
  const event = proofEventOf(tr);
  if (!event) return null;
  const before = blockAt(tr.before, event.pos);
  if (!before) return null;
  const old = paragraphText(before.node);
  const result = lookup(old.text);
  if (!result) return null;

  if (event.type === "reject") {
    const { from, to, start } = event.edit;
    return { text: old.text, result: { ...result, rejected: [...result.rejected, { from, to, start }] } };
  }

  const pos = tr.mapping.map(before.pos);
  const node = tr.doc.nodeAt(pos);
  if (!node?.isTextblock) return null;
  const now = paragraphText(node);
  const rejected = result.rejected.flatMap((edit) => {
    const offset = old.offsets[edit.start];
    if (offset === undefined) return [];
    const moved = tr.mapping.map(before.pos + 1 + offset, 1) - pos - 1;
    const start = now.offsets.indexOf(moved);
    return start === -1 ? [] : [{ ...edit, start }];
  });
  return { text: now.text, result: { corrected: result.corrected, rejected } };
}

/**
 * Words and open corrections for the score: only paragraphs whose check came
 * back count, so a half-checked chapter doesn't look flawless.
 */
export function languageStats(
  state: Parameters<typeof proofMarkCounts>[0],
  answered: (text: string) => boolean,
): { totalWords: number; counts: LanguageCounts } {
  let totalWords = 0;
  let checkedWords = 0;
  forEachCheckable(state.doc, (node) => {
    const { text } = paragraphText(node);
    const words = countWords(text);
    totalWords += words;
    if (answered(text)) checkedWords += words;
  });
  return { totalWords, counts: { words: checkedWords, ...proofMarkCounts(state) } };
}
