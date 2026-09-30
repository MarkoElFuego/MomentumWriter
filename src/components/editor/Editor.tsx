"use client";

import { EditorContent, useEditor, type Editor as TiptapEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { copy } from "@/lib/copy";
import { getLanguage, type Language } from "@/lib/languages";
import { SceneBreak } from "./sceneBreak";
import { closeProofTr, dispatchIf, openProofAtCursorTr, openProofMark, ProofMarks } from "./proofMarks";
import { atFootnoteEdge, Footnotes, insertFootnoteTr, isInFootnote, leaveFootnoteTr } from "./footnotes";
import {
  acceptGhost,
  acceptGhostWord,
  clearGhost,
  GhostText,
  hasGhost,
  hasGhostChoices,
  hasHint,
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
  const editor = useEditor({
    // Next.js renders on the server first; TipTap must mount on the client only.
    immediatelyRender: false,
    autofocus: "end",
    content: initialContent,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1] },
        // Replaced by Footnotes, which allows a note zone at the end.
        document: false,
        // Prose only: no code, lists-as-UI or links in v0.1.
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: false,
      }),
      Placeholder.configure({
        // Children too, so an empty note inside the zone gets its own hint.
        includeChildren: true,
        placeholder: ({ node }) =>
          node.type.name === "footnote" ? copy.footnotes.placeholder : copy.editor.placeholder,
      }),
      GhostText,
      Footnotes,
      ProofMarks,
      SceneBreak.configure({ symbol: getLanguage(language).typography.sceneBreak }),
    ],
    editorProps: {
      attributes: { class: "prose-editor", spellcheck: "true", lang: "sr" },
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

        // The "stuck?" hint goes away on the first key; the key still does its job.
        if (hasHint(view.state)) clearGhost(view);

        // A popover opened by a click leaves the cursor here; Esc closes it.
        if (event.key === "Escape" && openProofMark(view.state)) {
          return dispatchIf(view, closeProofTr(view.state));
        }

        // Alt+Enter on an underlined word opens its correction.
        if (event.altKey && !mod && !event.shiftKey && event.key === "Enter") {
          return dispatchIf(view, openProofAtCursorTr(view.state));
        }

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
