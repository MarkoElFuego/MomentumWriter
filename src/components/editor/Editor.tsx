"use client";

import { EditorContent, useEditor, type Editor as TiptapEditor, type JSONContent } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import { copy } from "@/lib/copy";
import type { Language } from "@/lib/languages";
import { blockStyleShortcut, setBlockStyle } from "./blockStyle";
import { contentExtensions } from "./contentSchema";
import { FocusMode } from "./focusMode";
import { closeProofTr, dispatchIf, openProofAtCursorTr, openProofMark, ProofMarks } from "./proofMarks";
import { atFootnoteEdge, insertFootnoteTr, isInFootnote, leaveFootnoteTr } from "./footnotes";
import {
  acceptGhost,
  acceptGhostWord,
  clearGhost,
  GhostText,
  hasGhost,
  hasGhostChoices,
  stepGhost,
} from "./ghostText";

// Runs a key action and tells ProseMirror the key was handled.
function run(action: () => void): true {
  action();
  return true;
}

interface EditorProps {
  initialContent: JSONContent;
  onChange: (content: JSONContent, text: string) => void;
  /** Book language — picks the scene-break symbol. */
  language: Language;
  onReady?: (editor: TiptapEditor) => void;
}

export function Editor({ initialContent, language, onChange, onReady }: EditorProps) {
  // Same document schema as contentSchema.ts, in the original plugin order.
  const [starterKit, textAlign, footnotes, sceneBreak] = contentExtensions(language);
  const editor = useEditor({
    // Next.js renders on the server first; TipTap must mount on the client only.
    immediatelyRender: false,
    // A chapter always opens at its beginning (author's decision 2026-10-02).
    autofocus: "start",
    content: initialContent,
    extensions: [
      starterKit,
      Placeholder.configure({
        // Children too, so an empty note inside the zone gets its own hint.
        includeChildren: true,
        placeholder: ({ node }) =>
          node.type.name === "footnote" ? copy.footnotes.placeholder : copy.editor.placeholder,
      }),
      GhostText,
      footnotes,
      ProofMarks,
      FocusMode,
      sceneBreak,
      // Alignment lives in the toolbar only — no extra Ctrl+Shift+L/E/R/J shortcuts.
      textAlign.extend({ addKeyboardShortcuts: () => ({}) }),
    ],
    editorProps: {
      attributes: { class: "prose-editor", spellcheck: "true", lang: "sr-Latn" },
      handleKeyDown: (view, event) => {
        const mod = event.ctrlKey || event.metaKey;
        const plainTab = event.key === "Tab" && !event.shiftKey && !mod && !event.altKey;

        // A visible gray completion owns Tab, Ctrl/Cmd+→, ↓/↑ and Esc.
        if (hasGhost(view.state)) {
          const bare = !mod && !event.altKey && !event.shiftKey;
          if (plainTab) return run(() => acceptGhost(view));
          if (mod && !event.altKey && !event.shiftKey && event.key === "ArrowRight") {
            return run(() => acceptGhostWord(view));
          }
          if (bare && hasGhostChoices(view.state)) {
            if (event.key === "ArrowDown") return run(() => stepGhost(view, 1));
            if (event.key === "ArrowUp") return run(() => stepGhost(view, -1));
          }
          if (event.key === "Escape") return run(() => clearGhost(view));
        }

        // A popover opened by a click leaves the cursor here; Esc closes it.
        if (event.key === "Escape" && openProofMark(view.state)) {
          return dispatchIf(view, closeProofTr(view.state));
        }

        // Alt+Enter on an underlined word opens its correction.
        if (event.altKey && !mod && !event.shiftKey && event.key === "Enter") {
          return dispatchIf(view, openProofAtCursorTr(view.state));
        }

        const style = blockStyleShortcut(event);
        if (style) return run(() => setBlockStyle(style)(view.state, view.dispatch));

        // Ctrl/Cmd+Shift+F — event.code too, for the Cyrillic layout.
        if (mod && event.shiftKey && !event.altKey && (event.key.toLowerCase() === "f" || event.code === "KeyF")) {
          return run(() => {
            const tr = insertFootnoteTr(view.state);
            if (tr) view.dispatch(tr);
          });
        }
        if (isInFootnote(view.state)) {
          const bare = !mod && !event.altKey && !event.shiftKey;
          // A note is one line: Esc or Enter goes back to the text after its number.
          if (bare && (event.key === "Escape" || event.key === "Enter")) {
            return run(() => {
              const tr = leaveFootnoteTr(view.state);
              if (tr) view.dispatch(tr);
            });
          }
          if (event.key === "Enter") return true;
          if ((event.key === "Backspace" || event.key === "Delete") && atFootnoteEdge(view.state, event.key)) {
            return true;
          }
        }

        // Tab only accepts suggestions; without one it does nothing instead of
        // throwing focus out of the text. Shift+Tab still leaves the editor.
        return plainTab;
      },
    },
    onCreate: ({ editor }) => onReady?.(editor),
    onUpdate: ({ editor }) =>
      onChange(editor.getJSON(), editor.getText({ blockSeparator: "\n" })),
  });

  return <EditorContent editor={editor} />;
}
