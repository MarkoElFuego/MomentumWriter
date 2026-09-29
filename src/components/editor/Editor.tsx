"use client";

import { EditorContent, useEditor, type Editor as TiptapEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef } from "react";
import { copy } from "@/lib/copy";
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
import { slashOpensMenu } from "@/lib/text/ghost";

// Runs a key action and tells ProseMirror the key was handled.
function run(action: () => void): true {
  action();
  return true;
}

interface EditorProps {
  initialContent: JSONContent;
  onChange: (content: JSONContent, text: string) => void;
  onReady?: (editor: TiptapEditor) => void;
  /** "/" at the start of a paragraph or after a space: open the Spark menu. */
  onSlash?: () => void;
}

export function Editor({ initialContent, onChange, onReady, onSlash }: EditorProps) {
  // useEditor keeps its first options; the ref lets handleKeyDown see fresh props.
  const onSlashRef = useRef(onSlash);
  useEffect(() => {
    onSlashRef.current = onSlash;
  }, [onSlash]);

  const editor = useEditor({
    // Next.js renders on the server first; TipTap must mount on the client only.
    immediatelyRender: false,
    autofocus: "end",
    content: initialContent,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1] },
        // Prose only: no code, lists-as-UI or links in v0.1.
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: false,
      }),
      Placeholder.configure({ placeholder: copy.editor.placeholder }),
      GhostText,
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

        // "/" (Shift+7 on Serbian layouts, so Shift is allowed) opens the menu where
        // it can't be part of a word; the slash itself is not typed.
        if (event.key === "/" && !mod && !event.altKey && onSlashRef.current) {
          const { selection } = view.state;
          const $head = selection.$head;
          const before = $head.parent.textBetween(0, $head.parentOffset);
          if (selection.empty && slashOpensMenu(before)) return run(() => onSlashRef.current?.());
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
