"use client";

import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { isInFootnote } from "@/components/editor/footnotes";
import { clearGhost, hasGhost, showGhost } from "@/components/editor/ghostText";
import { requestSpark } from "@/lib/ai/sparkClient";
import type { Language } from "@/lib/languages";
import { cursorSituation } from "@/lib/text/ghost";
import { extractContext } from "@/lib/text/extractContext";
import { joinStarter } from "@/lib/text/joinStarter";
import { GHOST_PAUSE_AFTER_MS, GHOST_PAUSE_MID_MS } from "@/lib/timing";

// The server trims to AI_GHOST_CONTEXT_WORDS anyway; this just keeps requests small.
const CLIENT_CONTEXT_WORDS = 150;

interface Titles {
  bookTitle: string;
  language: Language;
  chapterTitle: string;
}

/**
 * After a pause: gray completion mid-sentence, gray starter after a full stop.
 * An empty paragraph gets nothing (no AI call).
 */
export function useGhostText(editor: Editor | null, enabled: boolean, titles: Titles | null) {
  // Titles change on rename; the effect shouldn't resubscribe for that.
  const titlesRef = useRef(titles);
  useEffect(() => {
    titlesRef.current = titles;
  }, [titles]);

  useEffect(() => {
    if (!editor) return;
    if (!enabled) {
      clearGhost(editor.view);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;

    const cancel = () => {
      clearTimeout(timer);
      controller?.abort();
      controller = null;
    };

    const fetchGhost = async () => {
      const current = titlesRef.current;
      if (!current) return;
      const { doc, selection } = editor.state;
      const pos = selection.from;
      controller = new AbortController();
      const { signal } = controller;

      const result = await requestSpark(
        { mode: "ghost", context: extractContext(doc, pos, CLIENT_CONTEXT_WORDS), ...current },
        signal,
      );
      // Stale if the author kept typing or moved; errors just mean no suggestion.
      if (signal.aborted || !result.ok || !("items" in result.data)) return;
      if (editor.isDestroyed || editor.state.doc !== doc || editor.state.selection.from !== pos) return;

      const charBefore = doc.textBetween(Math.max(0, pos - 1), pos);
      const items = result.data.items.map((item) => joinStarter(charBefore, item.text).trimEnd());
      showGhost(editor.view, pos, items);
    };

    const schedule = () => {
      cancel();
      const { state } = editor;
      // No suggestions while writing a footnote.
      if (hasGhost(state) || isInFootnote(state)) return;
      const { selection } = state;
      const $head = selection.$head;
      // Headings are titles, not sentences — no completions there.
      if (!$head.parent.isTextblock || $head.parent.type.name === "heading") return;

      const block = $head.parent;
      const situation = cursorSituation(
        block.textBetween(0, $head.parentOffset),
        block.textBetween($head.parentOffset, block.content.size),
        selection.empty,
      );

      if (situation === "mid" || situation === "after") {
        const pause = situation === "mid" ? GHOST_PAUSE_MID_MS : GHOST_PAUSE_AFTER_MS;
        timer = setTimeout(() => void fetchGhost(), pause);
      }
    };

    editor.on("update", schedule);
    editor.on("selectionUpdate", schedule);
    return () => {
      editor.off("update", schedule);
      editor.off("selectionUpdate", schedule);
      cancel();
    };
  }, [editor, enabled]);
}
