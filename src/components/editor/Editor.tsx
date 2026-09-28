"use client";

import { EditorContent, useEditor, type Editor as TiptapEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { copy } from "@/lib/copy";

interface EditorProps {
  initialContent: JSONContent;
  onChange: (content: JSONContent, text: string) => void;
  onReady?: (editor: TiptapEditor) => void;
}

export function Editor({ initialContent, onChange, onReady }: EditorProps) {
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
    ],
    editorProps: {
      attributes: { class: "prose-editor", spellcheck: "true", lang: "sr" },
    },
    onCreate: ({ editor }) => onReady?.(editor),
    onUpdate: ({ editor }) =>
      onChange(editor.getJSON(), editor.getText({ blockSeparator: "\n" })),
  });

  return <EditorContent editor={editor} />;
}
