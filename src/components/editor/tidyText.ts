import type { JSONContent } from "@tiptap/react";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { endsSentence } from "@/lib/text/sentences";
import { isInFootnote, mainTextEnd } from "./footnotes";

// „Sredi tekst” (odluka autora 2026-10-06): cleans up text pasted from Word,
// PDF or the web — spaces, empty lines, paragraphs split line by line, foreign
// formatting. No AI, and no word changes except joining a word hyphenated at a
// line end. One transaction, so one Ctrl+Z brings everything back.

/** The author's own formatting and notes; anything else pasted in (strike, underline…) goes. */
const KEPT_MARKS = new Set(["bold", "italic", "laterNote"]);
const TEXT_BLOCKS = new Set(["paragraph", "heading"]);
const LISTS = new Set(["bulletList", "orderedList"]);

type Run = { kind: "text"; text: string; marks: JSONContent["marks"] } | { kind: "atom"; node: JSONContent };

const sameMarks = (a: JSONContent["marks"], b: JSONContent["marks"]) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

// "rastav-⏎ljeno" → "rastavljeno": a letter, a hyphen at the line end and a lowercase letter after.
const HYPHENATED_BREAK = /(\p{L})-\n[ \t]*(?=\p{Ll})/gu;
// Every kind of whitespace except the no-break space (U+00A0), which an author may want.
const SPACES = /[^\S ]+/gu;

function toRuns(content: JSONContent[] | undefined): Run[] {
  const runs: Run[] = [];
  for (const node of content ?? []) {
    let run: Run;
    if (node.type === "text") {
      const marks = node.marks?.filter((mark) => KEPT_MARKS.has(mark.type ?? ""));
      run = { kind: "text", text: (node.text ?? "").replace(/­/gu, ""), marks: marks?.length ? marks : undefined };
    } else if (node.type === "hardBreak") {
      // Shift+Enter (or a PDF line end) inside a paragraph: a space, unless it splits a word.
      // It takes the marks of the text before it, so a hyphenated word in bold still joins.
      const last = runs.at(-1);
      run = { kind: "text", text: "\n", marks: last?.kind === "text" ? last.marks : undefined };
    } else {
      run = { kind: "atom", node };
    }
    const last = runs.at(-1);
    if (run.kind === "text" && last?.kind === "text" && sameMarks(last.marks, run.marks)) {
      last.text += run.text;
    } else {
      runs.push(run);
    }
  }
  return runs;
}

/** Inline content with tidy spaces: none at the start or end, never two in a row. */
function tidyInline(content: JSONContent[] | undefined): JSONContent[] {
  const runs = toRuns(content);
  let afterSpace = true; // trims the start
  for (const run of runs) {
    if (run.kind === "atom") {
      afterSpace = false;
      continue;
    }
    let text = run.text.replace(HYPHENATED_BREAK, "$1").replace(SPACES, " ");
    if (afterSpace) text = text.replace(/^ /u, "");
    if (text) afterSpace = text.endsWith(" ");
    run.text = text;
  }
  // Trailing space: walk back over runs that end up empty.
  for (let i = runs.length - 1; i >= 0; i--) {
    const run = runs[i]!;
    if (run.kind === "atom") break;
    run.text = run.text.replace(/ $/u, "");
    if (run.text) break;
  }
  return runs.flatMap((run): JSONContent[] => {
    if (run.kind === "atom") return [run.node];
    if (!run.text) return [];
    return [run.marks ? { type: "text", text: run.text, marks: run.marks } : { type: "text", text: run.text }];
  });
}

const plainText = (block: JSONContent) => (block.content ?? []).map((node) => node.text ?? "").join("");

/** A paragraph split line by line: the first part doesn't end a sentence and the next starts lowercase. */
function continues(previous: JSONContent, next: JSONContent): boolean {
  return (
    previous.type === "paragraph" &&
    next.type === "paragraph" &&
    !endsSentence(plainText(previous)) &&
    /^\p{Ll}/u.test(plainText(next))
  );
}

function join(previous: JSONContent, next: JSONContent): JSONContent {
  const glue: JSONContent = /\p{L}-$/u.test(plainText(previous)) ? { type: "hardBreak" } : { type: "text", text: " " };
  // The hard break goes through the same hyphen rule as Shift+Enter: "rastav-" + "ljeno" joins.
  return { ...previous, content: tidyInline([...(previous.content ?? []), glue, ...(next.content ?? [])]) };
}

/** Lists become plain paragraphs (nested ones too), in order. */
function flattenLists(blocks: JSONContent[]): JSONContent[] {
  return blocks.flatMap((block) => {
    if (LISTS.has(block.type ?? "")) {
      return flattenLists((block.content ?? []).flatMap((item) => item.content ?? []));
    }
    return [block];
  });
}

function tidyLevel(blocks: JSONContent[]): JSONContent[] {
  const out: JSONContent[] = [];
  for (const block of flattenLists(blocks)) {
    let tidy: JSONContent | null;
    if (TEXT_BLOCKS.has(block.type ?? "")) {
      const content = tidyInline(block.content);
      // An empty line: paragraphs already have space between them.
      tidy = content.length ? { ...block, content } : null;
    } else if (block.type === "blockquote") {
      const content = tidyLevel(block.content ?? []);
      tidy = content.length ? { ...block, content } : null;
    } else {
      tidy = block; // sceneBreak and anything else stays as it is
    }
    if (!tidy) continue;

    const previous = out.at(-1);
    if (previous && continues(previous, tidy)) out[out.length - 1] = join(previous, tidy);
    else out.push(tidy);
  }
  return out;
}

/** Whole blocks in, whole blocks out — never empty, so a cleared selection still leaves a paragraph. */
export function tidyBlocks(blocks: JSONContent[]): JSONContent[] {
  const out = tidyLevel(blocks);
  return out.length ? out : [{ type: "paragraph" }];
}

/**
 * The selection (widened to whole blocks), or without one the whole main text.
 * The footnote zone is never touched. Null when nothing would change.
 */
export function tidyTr(state: EditorState): Transaction | null {
  if (isInFootnote(state)) return null;
  const { doc, selection } = state;
  const end = mainTextEnd(doc);
  let from = 0;
  let to = end;
  if (!selection.empty) {
    const $from = doc.resolve(Math.min(selection.from, end));
    const $to = doc.resolve(Math.min(selection.to, end));
    from = $from.depth > 0 ? $from.before(1) : $from.pos;
    to = $to.depth > 0 ? $to.after(1) : $to.pos;
  }
  if (from >= to) return null;

  const blocks: JSONContent[] = [];
  doc.slice(from, to).content.forEach((node) => blocks.push(node.toJSON() as JSONContent));
  const tidy = tidyBlocks(blocks);
  if (JSON.stringify(tidy) === JSON.stringify(blocks)) return null;

  const nodes = tidy.map((block) => state.schema.nodeFromJSON(block));
  return state.tr.replaceWith(from, to, nodes).scrollIntoView();
}
