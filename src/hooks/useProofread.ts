"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import {
  clearProofTr,
  hasProofMarks,
  markRanges,
  openProofMark,
  paragraphText,
  setProofMarksTr,
  type OpenProofMark,
} from "@/components/editor/proofMarks";
import { MAX_PROOFREAD_WORDS } from "@/lib/ai/proofread";
import { requestProofread } from "@/lib/ai/sparkClient";
import type { Language } from "@/lib/languages";
import { countWords } from "@/lib/text/countWords";
import { proofDiff, type DroppedChange } from "@/lib/text/proofDiff";
import { PROOFREAD_PAUSE_MS } from "@/lib/timing";

// Enough to remember a long chapter's paragraphs without growing forever.
const MAX_REMEMBERED = 500;

/**
 * Text the author can proofread: any paragraph or heading — also inside a quote
 * or a list, which pasted text often lands in — but never a footnote (Faza 4).
 */
function isCheckable(node: PMNode | null | undefined): node is PMNode {
  return !!node && node.isTextblock && node.type.name !== "footnote";
}

function forEachCheckable(doc: PMNode, visit: (node: PMNode, pos: number) => void) {
  doc.descendants((node, pos) => {
    if (node.type.name === "footnotes") return false;
    if (isCheckable(node)) {
      visit(node, pos);
      return false;
    }
    return true;
  });
}

/** The block with exactly this text nearest to where it was sent from. */
function findParagraph(doc: PMNode, text: string, near: number): { node: PMNode; pos: number } | null {
  let best: { node: PMNode; pos: number } | null = null;
  forEachCheckable(doc, (node, pos) => {
    if (paragraphText(node).text !== text) return;
    if (!best || Math.abs(pos - near) < Math.abs(best.pos - near)) best = { node, pos };
  });
  return best;
}

function devLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") console.debug("[proofread]", ...args);
}

// Dev only (F12): what the proofreader answered and what was not underlined, and why.
function logProofread(text: string, corrected: string, offered: number, shown: number, dropped: DroppedChange[]) {
  if (process.env.NODE_ENV === "production") return;
  if (text === corrected) return console.debug("[proofread] bez ispravki:", text.slice(0, 60));
  console.groupCollapsed(`[proofread] ${shown} podvlaka · ${dropped.length} odbačeno · ${text.slice(0, 40)}…`);
  console.log("pasus:   ", text);
  console.log("ispravka:", corrected);
  if (shown < offered) console.log(`${offered - shown} ispravki preskočeno jer prelaze broj fusnote`);
  for (const d of dropped) console.log(`odbačeno (${d.reason}): „${d.from}” → „${d.to}”`);
  console.groupEnd();
}

// Two at a time: opening a long chapter shouldn't fire dozens of requests at once.
const MAX_PARALLEL = 2;

/** Start of the text block holding the cursor. */
function cursorBlock(state: EditorState): number | null {
  const { $from } = state.selection;
  return $from.depth >= 1 && $from.parent.isTextblock ? $from.before() : null;
}

/**
 * Every paragraph is proofread once: all of them when the chapter opens, then
 * each new or changed one as soon as the cursor leaves it (Enter, arrows, a
 * click) or the author pauses typing in it. Answers come back as underlines
 * (proofMarks), never as changed text.
 */
export function useProofread(editor: Editor | null, enabled: boolean, language: Language | null) {
  useEffect(() => {
    if (!editor) return;
    if (!enabled || !language) {
      if (hasProofMarks(editor.state)) editor.view.dispatch(clearProofTr(editor.state));
      return;
    }

    // Paragraph texts already sent or queued — an unchanged paragraph is never sent twice.
    const checked = new Set<string>();
    const controllers = new Set<AbortController>();
    const queue: { text: string; near: number }[] = [];
    let running = 0;

    const check = async (text: string, near: number) => {
      const controller = new AbortController();
      controllers.add(controller);
      const result = await requestProofread({ mode: "proofread", text, language }, controller.signal);
      controllers.delete(controller);
      if (controller.signal.aborted || editor.isDestroyed) return;
      // Network/timeout → forget it so leaving the paragraph retries; a rejection stays remembered.
      if (!result.ok) {
        devLog(result.retry ? "nije uspelo, pokušaće ponovo:" : "server odbio:", text.slice(0, 60));
        if (result.retry) checked.delete(text);
        return;
      }
      const { corrected } = result;

      // The author may have kept typing; only a paragraph that still reads the same gets marks.
      const found = findParagraph(editor.state.doc, text, near);
      if (!found) {
        devLog("pasus se u međuvremenu promenio:", text.slice(0, 60));
        return void checked.delete(text);
      }
      const dropped: DroppedChange[] = [];
      const edits = proofDiff(text, corrected, dropped);
      const marks = markRanges(found.node, found.pos, edits);
      logProofread(text, corrected, edits.length, marks.length, dropped);
      const end = found.pos + found.node.nodeSize;
      editor.view.dispatch(setProofMarksTr(editor.state, found.pos, end, marks));
    };

    const pump = () => {
      while (running < MAX_PARALLEL && queue.length > 0) {
        const next = queue.shift()!;
        running++;
        void check(next.text, next.near).finally(() => {
          running--;
          pump();
        });
      }
    };

    const enqueue = (node: PMNode | null | undefined, pos: number) => {
      if (!isCheckable(node)) return;
      const { text } = paragraphText(node);
      const words = countWords(text);
      if (words > MAX_PROOFREAD_WORDS) devLog(`preskočen, ${words} reči (najviše ${MAX_PROOFREAD_WORDS}):`, text.slice(0, 60));
      if (words === 0 || words > MAX_PROOFREAD_WORDS || checked.has(text)) return;
      if (checked.size >= MAX_REMEMBERED) checked.clear();
      checked.add(text);
      queue.push({ text, near: pos });
      pump();
    };

    // Opening the chapter: everything already written, top to bottom.
    let current = cursorBlock(editor.state);
    forEachCheckable(editor.state.doc, enqueue);

    // A pause in typing → check the paragraph being written.
    let pause: ReturnType<typeof setTimeout> | undefined;
    const checkCurrent = () => {
      const block = cursorBlock(editor.state);
      if (block !== null && !editor.isDestroyed) enqueue(editor.state.doc.nodeAt(block), block);
    };

    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.docChanged) {
        clearTimeout(pause);
        pause = setTimeout(checkCurrent, PROOFREAD_PAUSE_MS);
      }
      // The cursor left a paragraph → check it (a no-op if its text was already checked).
      const previous = current === null ? null : transaction.mapping.map(current);
      current = cursorBlock(editor.state);
      if (previous === null || previous === current) return;
      const { doc } = editor.state;
      if (previous < doc.content.size) enqueue(doc.nodeAt(previous), previous);
    };

    editor.on("transaction", onTransaction);
    return () => {
      clearTimeout(pause);
      editor.off("transaction", onTransaction);
      queue.length = 0;
      for (const controller of controllers) controller.abort();
    };
  }, [editor, enabled, language]);
}

/** The underline whose popover is open, kept in sync with the editor. */
export function useOpenProofMark(editor: Editor | null): OpenProofMark | null {
  const [open, setOpen] = useState<OpenProofMark | null>(null);
  useEffect(() => {
    if (!editor) return;
    const sync = () =>
      setOpen((current) => {
        const next = openProofMark(editor.state);
        const same =
          current?.id === next?.id &&
          current?.from === next?.from &&
          current?.focus === next?.focus &&
          current?.diacriticsInParagraph === next?.diacriticsInParagraph;
        return same ? current : next;
      });
    editor.on("transaction", sync);
    return () => {
      editor.off("transaction", sync);
    };
  }, [editor]);
  return open;
}
