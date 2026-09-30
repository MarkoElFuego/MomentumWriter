// Turns the proofreader's corrected paragraph into word-level edits the author
// accepts one by one. The corrected text itself is never inserted.

export interface ProofEdit {
  /** Word as the author wrote it (with its punctuation). */
  from: string;
  to: string;
  /** Offsets of `from` in the original paragraph text. */
  start: number;
  end: number;
  /** Only č/ć/š/ž/đ differ → dotted underline; anything else → wavy. */
  type: "diacritic" | "grammar";
}

interface Token {
  text: string;
  start: number;
  end: number;
}

/** At least this share of the reply's words must come from the paragraph. */
const MIN_SHARED_SHARE = 0.5;
const MAX_DISTANCE = 3;
const MAX_DISTANCE_SHARE = 0.4;

const PLAIN: Record<string, string> = { č: "c", ć: "c", š: "s", ž: "z", đ: "dj", Č: "C", Ć: "C", Š: "S", Ž: "Z", Đ: "Dj" };

/** "Đorđe" → "Djordje": the word as it looks without diacritics. */
export function stripDiacritics(word: string): string {
  return word.replace(/[čćšžđČĆŠŽĐ]/gu, (letter) => PLAIN[letter]!);
}

function tokenize(text: string): Token[] {
  return [...text.matchAll(/\S+/gu)].map((match) => ({
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** A correction, not a rewrite. Diacritics cost nothing, so "Djordje → Đorđe" passes. */
function isSimilar(from: string, to: string): boolean {
  const a = stripDiacritics(from);
  const b = stripDiacritics(to);
  const distance = levenshtein(a, b);
  return distance <= MAX_DISTANCE && distance <= MAX_DISTANCE_SHARE * Math.max(a.length, b.length);
}

// The word without diacritics, case or punctuation — "Škole," and "skole" match.
const bare = (word: string) => stripDiacritics(word).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

type Op = { kind: "pair"; a: Token; b: Token } | { kind: "del"; a: Token } | { kind: "ins"; b: Token };

/**
 * Lines the reply up with the paragraph word by word. Identical words pair
 * first, then corrections of each other ("skole"/"škole."); the rest is
 * dropped (del) or added (ins) by the proofreader.
 */
function align(a: Token[], b: Token[]): Op[] {
  const score = (x: Token, y: Token) => (x.text === y.text ? 2 : isSimilar(x.text, y.text) ? 1 : 0);
  const pairScore = a.map((x) => b.map((y) => score(x, y)));
  const best = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const pair = pairScore[i]![j]! > 0 ? pairScore[i]![j]! + best[i + 1]![j + 1]! : 0;
      best[i]![j] = Math.max(pair, best[i + 1]![j]!, best[i]![j + 1]!);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const s = i < a.length && j < b.length ? pairScore[i]![j]! : 0;
    if (s > 0 && best[i]![j] === s + best[i + 1]![j + 1]!) {
      ops.push({ kind: "pair", a: a[i++]!, b: b[j++]! });
    } else if (j >= b.length || (i < a.length && best[i + 1]![j]! >= best[i]![j + 1]!)) {
      ops.push({ kind: "del", a: a[i++]! });
    } else {
      ops.push({ kind: "ins", b: b[j++]! });
    }
  }
  return ops;
}

/**
 * Proofread, not rewritten: at least half of the reply's words are the
 * author's words (same or corrected). Dropping a duplicated sentence still
 * passes; a paragraph retold in new words does not.
 */
export function isProofreadOf(original: string, corrected: string): boolean {
  const reply = tokenize(corrected);
  if (reply.length === 0) return false;
  const kept = align(tokenize(original), reply).filter((op) => op.kind === "pair").length;
  return kept >= MIN_SHARED_SHARE * reply.length;
}

/** A correction the proofreader made that is not offered, and why (dev console). */
export interface DroppedChange {
  from: string;
  to: string;
  reason: "not-a-correction" | "too-big";
}

const MAX_CLUSTER_WORDS = 3;
const SHORT_WORD_LETTERS = 4;

interface Segment {
  a: Token[];
  b: Token[];
  changed: boolean;
}

/**
 * Word-level corrections from the proofreader's paragraph. Most are one word
 * ("skole" → "škole"); a few words may be joined, split, added or dropped when
 * that is the correction ("kapkeDosao" → "kapke. Došao", "njega" → "za njega",
 * "je" → "su"). Anything bigger — a new long word, a dropped sentence — is not
 * offered: that's editing, not proofreading. Offsets point into `original`.
 */
export function proofDiff(original: string, corrected: string, dropped?: DroppedChange[]): ProofEdit[] {
  if (!isProofreadOf(original, corrected)) {
    dropped?.push({ from: original, to: corrected, reason: "too-big" });
    return [];
  }

  const text = (tokens: Token[]) => tokens.map((t) => t.text).join(" ");
  const segments: Segment[] = [];
  const ops = align(tokenize(original), tokenize(corrected));

  for (let k = 0; k < ops.length; ) {
    const op = ops[k]!;
    if (op.kind === "pair") {
      segments.push({ a: [op.a], b: [op.b], changed: op.a.text !== op.b.text });
      k++;
      continue;
    }
    const dels: Token[] = [];
    const inss: Token[] = [];
    while (k < ops.length && ops[k]!.kind !== "pair") {
      const extra = ops[k]!;
      if (extra.kind === "del") dels.push(extra.a);
      else if (extra.kind === "ins") inss.push(extra.b);
      k++;
    }

    const small =
      dels.length <= MAX_CLUSTER_WORDS &&
      inss.length <= MAX_CLUSTER_WORDS &&
      [...dels, ...inss].every((t) => bare(t.text).length <= SHORT_WORD_LETTERS);
    const joinedSimilar = dels.length > 0 && inss.length > 0 && isSimilar(text(dels), text(inss));
    if (!small && !joinedSimilar) {
      const reason = dels.length + inss.length > 2 * MAX_CLUSTER_WORDS ? "too-big" : "not-a-correction";
      dropped?.push({ from: text(dels), to: text(inss), reason });
      continue;
    }
    if (dels.length && inss.length) {
      segments.push({ a: dels, b: inss, changed: true });
      continue;
    }

    // Only added or only dropped words: ride on a neighbor so there's a word to
    // underline — an unchanged one first, so each correction stays separate.
    const prev = segments.at(-1);
    const nextOp = ops[k];
    const next: Segment | undefined =
      nextOp?.kind === "pair" ? { a: [nextOp.a], b: [nextOp.b], changed: nextOp.a.text !== nextOp.b.text } : undefined;
    if (next && !next.changed) {
      segments.push({ a: [...dels, ...next.a], b: [...inss, ...next.b], changed: true });
      k++;
    } else if (prev && !prev.changed) {
      prev.a.push(...dels);
      prev.b.push(...inss);
      prev.changed = true;
    } else if (prev) {
      prev.a.push(...dels);
      prev.b.push(...inss);
    } else if (next) {
      segments.push({ a: [...dels, ...next.a], b: [...inss, ...next.b], changed: true });
      k++;
    }
  }

  const edits: ProofEdit[] = [];
  for (const { a, b, changed } of segments) {
    if (!changed || a.length === 0 || b.length === 0) continue;
    const start = a[0]!.start;
    const end = a.at(-1)!.end;
    const from = original.slice(start, end);
    const to = corrected.slice(b[0]!.start, b.at(-1)!.end);
    // A line break inside can't be matched back to the paragraph reliably.
    if (from.includes("\n")) continue;
    const type = stripDiacritics(from) === stripDiacritics(to) ? "diacritic" : "grammar";
    edits.push({ from, to, start, end, type });
  }
  return edits;
}
