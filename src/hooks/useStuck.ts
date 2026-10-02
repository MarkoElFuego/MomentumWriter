"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { mainTextEnd } from "@/components/editor/footnotes";
import { requestSpark } from "@/lib/ai/sparkClient";
import type { Language } from "@/lib/languages";
import { countWords } from "@/lib/text/countWords";
import { extractContext } from "@/lib/text/extractContext";

// Fewer words than this before the cursor: nothing to ask about yet, so no call.
const MIN_WORDS = 30;
const CONTEXT_WORDS = 400;
// "Još jedno" tells the model what was already asked — the last few are enough.
const MAX_AVOID = 5;

export type StuckState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; question: string }
  | { kind: "tooShort" }
  | { kind: "error" };

interface Titles {
  bookTitle: string;
  chapterTitle: string;
  language: Language;
}

/** „Zapeo sam”: one question from Tiron about the scene before the cursor. */
export function useStuck(editor: Editor | null, titles: Titles | null) {
  const [state, setState] = useState<StuckState>({ kind: "idle" });
  const asked = useRef<string[]>([]);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  const ask = useCallback(async () => {
    if (!editor || !titles) return;
    inFlight.current?.abort();

    // Only the prose before the cursor — a cursor in a footnote counts as the end of the text.
    const { doc, selection } = editor.state;
    const pos = Math.min(selection.from, mainTextEnd(doc));
    if (countWords(doc.textBetween(0, pos, "\n\n")) < MIN_WORDS) {
      setState({ kind: "tooShort" });
      return;
    }

    const controller = new AbortController();
    inFlight.current = controller;
    setState({ kind: "loading" });
    const result = await requestSpark(
      {
        mode: "stuck",
        context: extractContext(doc, pos, CONTEXT_WORDS),
        ...titles,
        avoid: asked.current.slice(-MAX_AVOID),
      },
      controller.signal,
    );
    if (controller.signal.aborted) return;
    inFlight.current = null;

    if (result.ok && "question" in result.data) {
      asked.current.push(result.data.question);
      setState({ kind: "ready", question: result.data.question });
    } else {
      setState({ kind: "error" });
    }
  }, [editor, titles]);

  return { state, ask };
}
