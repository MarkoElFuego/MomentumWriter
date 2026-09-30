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

const MAX_WORD_COUNT_DRIFT = 0.2;
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

/** More than 20% words added or dropped means the model rewrote instead of proofreading. */
export function wordCountClose(original: string, corrected: string): boolean {
  const a = tokenize(original).length;
  const b = tokenize(corrected).length;
  return Math.abs(a - b) <= MAX_WORD_COUNT_DRIFT * Math.max(a, 1);
}

// Longest common subsequence of words → the pairs of runs that differ between them.
function changedRuns(a: Token[], b: Token[]): [Token[], Token[]][] {
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i]!.text === b[j]!.text ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const runs: [Token[], Token[]][] = [];
  let i = 0;
  let j = 0;
  let runA: Token[] = [];
  let runB: Token[] = [];
  const flush = () => {
    if (runA.length || runB.length) runs.push([runA, runB]);
    runA = [];
    runB = [];
  };
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i]!.text === b[j]!.text) {
      flush();
      i++;
      j++;
    } else if (j >= b.length || (i < a.length && lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
      runA.push(a[i++]!);
    } else {
      runB.push(b[j++]!);
    }
  }
  flush();
  return runs;
}

export function proofDiff(original: string, corrected: string): ProofEdit[] {
  if (!wordCountClose(original, corrected)) return [];
  const edits: ProofEdit[] = [];
  for (const [runA, runB] of changedRuns(tokenize(original), tokenize(corrected))) {
    // Only word-for-word replacements are offered; an added or dropped word is
    // skipped on the longer side so the words around it still pair up.
    let i = 0;
    let j = 0;
    while (i < runA.length && j < runB.length) {
      const word = runA[i]!;
      const to = runB[j]!.text;
      if (isSimilar(word.text, to)) {
        const type = stripDiacritics(word.text) === stripDiacritics(to) ? "diacritic" : "grammar";
        edits.push({ from: word.text, to, start: word.start, end: word.end, type });
        i++;
        j++;
      } else if (runA.length - i > runB.length - j) i++;
      else if (runB.length - j > runA.length - i) j++;
      else {
        i++;
        j++;
      }
    }
  }
  return edits;
}
