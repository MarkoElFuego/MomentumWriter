"use client";

import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { clearGhost, hasGhost, showGhost } from "@/components/editor/ghostText";
import { requestSpark } from "@/lib/ai/sparkClient";
import { canSuggest } from "@/lib/text/ghost";
import { extractContext } from "@/lib/text/extractContext";
import { joinStarter } from "@/lib/text/joinStarter";

// Long enough that it never interrupts a typing burst, short enough to feel alive.
const PAUSE_MS = 1_500;
// The server trims to AI_GHOST_CONTEXT_WORDS anyway; this just keeps requests small.
const CLIENT_CONTEXT_WORDS = 150;

interface Titles {
  bookTitle: string;
  chapterTitle: string;
  sceneTitle: string;
}

/** Fetches gray completions after a pause in an unfinished sentence. */
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
      if (hasGhost(state)) return;
      const { selection } = state;
      const $head = selection.$head;
      const textBefore = state.doc.textBetween(0, selection.from, "\n\n");
      const textAfter = $head.parent.textBetween($head.parentOffset, $head.parent.content.size);
      if (!canSuggest(textBefore, textAfter, selection.empty)) return;
      timer = setTimeout(() => void fetchGhost(), PAUSE_MS);
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
