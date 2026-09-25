"use client";

import { useState } from "react";
import { copy } from "@/lib/copy";
import { countWords } from "@/lib/text/countWords";
import { Editor } from "./Editor";
import { EditorFooter } from "./EditorFooter";
import { EditorHeader } from "./EditorHeader";

export function WriteScreen() {
  const [wordCount, setWordCount] = useState(0);

  return (
    <div className="flex h-dvh flex-col">
      <EditorHeader chapterTitle={copy.editor.defaultChapterTitle} />
      <main className="flex-1 overflow-y-auto px-6">
        <div className="mx-auto max-w-[66ch] py-16">
          <Editor onTextChange={(text) => setWordCount(countWords(text))} />
        </div>
      </main>
      <EditorFooter wordsToday={wordCount} />
    </div>
  );
}
