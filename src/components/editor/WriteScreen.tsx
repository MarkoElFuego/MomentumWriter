"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor as TiptapEditor, JSONContent } from "@tiptap/react";
import { SparkPalette, type SparkAnchor } from "@/components/spark/SparkPalette";
import { StructurePanel } from "@/components/structure/StructurePanel";
import { useAutosave } from "@/hooks/useAutosave";
import { copy } from "@/lib/copy";
import { getChapter } from "@/lib/db/chapters";
import type { ID } from "@/lib/db/schema";
import { saveScene } from "@/lib/db/scenes";
import { openScene, type OpenedScene } from "@/lib/db/session";
import { localDateKey, wordsDelta } from "@/lib/stats/today";
import { countWords } from "@/lib/text/countWords";
import { extractContext } from "@/lib/text/extractContext";
import { lastSentence } from "@/lib/text/lastSentence";
import { Editor } from "./Editor";
import { EditorFooter } from "./EditorFooter";
import { EditorHeader } from "./EditorHeader";

// Panel open/closed survives scene switches (the page remounts on each one).
const PANEL_KEY = "momentum:structureOpen";

function readPanelOpen(): boolean {
  try {
    return sessionStorage.getItem(PANEL_KEY) === "1";
  } catch {
    return false;
  }
}

function writePanelOpen(open: boolean) {
  try {
    sessionStorage.setItem(PANEL_KEY, open ? "1" : "0");
  } catch {
    // UI preference only — safe to ignore.
  }
}

type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "failed" }
  | { kind: "ready"; data: OpenedScene };

export function WriteScreen({ sceneId }: { sceneId: ID }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [chapterTitle, setChapterTitle] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [panel, setPanel] = useState<{ open: boolean; autoFocus: boolean }>({
    open: false,
    autoFocus: false,
  });
  // Cursor position and context are frozen when the palette opens.
  const [spark, setSpark] = useState<{ pos: number; context: string; anchor: SparkAnchor | null } | null>(
    null,
  );
  const latest = useRef<{ content: JSONContent; wordCount: number } | null>(null);
  const editorRef = useRef<TiptapEditor | null>(null);

  useEffect(() => {
    let cancelled = false;
    openScene(sceneId, localDateKey())
      .then((data) => {
        if (cancelled) return;
        if (!data) return setState({ kind: "missing" });
        setState({ kind: "ready", data });
        setChapterTitle(data.chapter.title);
        setWordCount(data.scene.wordCount);
      })
      .catch((error) => {
        console.error("Failed to open scene", error);
        if (!cancelled) setState({ kind: "failed" });
      });
    if (readPanelOpen()) setPanel({ open: true, autoFocus: false });
    return () => {
      cancelled = true;
    };
  }, [sceneId]);

  const save = useCallback(async () => {
    if (!latest.current) return;
    // Read the cursor at save time (after the debounce), not on every keystroke.
    const editor = editorRef.current;
    const cursor = editor && {
      pos: editor.state.selection.from,
      lastSentence: lastSentence(editor.state.doc.textBetween(0, editor.state.selection.from, "\n\n")),
    };
    await saveScene(
      sceneId,
      latest.current.content,
      latest.current.wordCount,
      localDateKey(),
      cursor ?? undefined,
    );
  }, [sceneId]);

  const { status, schedule, flush } = useAutosave(save);

  const handleChange = useCallback(
    (content: JSONContent, text: string) => {
      const count = countWords(text);
      latest.current = { content, wordCount: count };
      setWordCount(count);
      schedule();
    },
    [schedule],
  );

  const setPanelOpen = useCallback((open: boolean, autoFocus: boolean) => {
    setPanel({ open, autoFocus });
    writePanelOpen(open);
    if (!open) editorRef.current?.commands.focus();
  }, []);

  const togglePanel = useCallback(
    () => setPanelOpen(!panel.open, !panel.open),
    [panel.open, setPanelOpen],
  );

  const openSpark = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const pos = editor.state.selection.from;
    let anchor: SparkAnchor | null = null;
    try {
      const { left, top, bottom } = editor.view.coordsAtPos(pos);
      anchor = { left, top, bottom };
    } catch {
      // View not laid out yet — the palette falls back to the footer corner.
    }
    setSpark({ pos, context: extractContext(editor.state.doc, pos), anchor });
  }, []);

  const closeSpark = useCallback(() => {
    const editor = editorRef.current;
    // If the writer already clicked back into the text, don't yank the cursor.
    if (spark && editor && !editor.isFocused) {
      editor.chain().focus().setTextSelection(spark.pos).run();
    }
    setSpark(null);
  }, [spark]);

  const toggleSpark = useCallback(
    () => (spark ? closeSpark() : openSpark()),
    [spark, closeSpark, openSpark],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      // event.code keeps shortcuts working where "\" needs AltGr (Serbian Latin)
      // or J is a different letter (Cyrillic).
      if (event.key === "\\" || event.code === "Backslash") {
        event.preventDefault();
        togglePanel();
      } else if (event.key.toLowerCase() === "j" || event.code === "KeyJ") {
        event.preventDefault();
        toggleSpark();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePanel, toggleSpark]);

  const navigate = useCallback(
    async (targetId: ID) => {
      await flush();
      router.push(`/write/${targetId}`);
    },
    [flush, router],
  );

  const refreshTitles = useCallback(async () => {
    if (state.kind !== "ready") return;
    const chapter = await getChapter(state.data.chapter.id);
    if (chapter) setChapterTitle(chapter.title);
  }, [state]);

  if (state.kind === "loading") return <div className="h-dvh" />;

  if (state.kind !== "ready") {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-muted">
        <p>{state.kind === "missing" ? copy.write.notFound : copy.write.loadFailed}</p>
        <Link href="/" className="ui-button mt-4 inline-block underline">
          {copy.write.backToLibrary}
        </Link>
      </main>
    );
  }

  const { data } = state;
  const wordsToday = wordsDelta(data.startWordTotal, data.otherScenesTotal + wordCount);

  return (
    <div className="flex h-dvh">
      {panel.open && (
        <StructurePanel
          bookId={data.book.id}
          currentSceneId={sceneId}
          autoFocus={panel.autoFocus}
          onNavigate={(id) => void navigate(id)}
          onClose={() => setPanelOpen(false, false)}
          onChanged={() => void refreshTitles()}
        />
      )}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <EditorHeader
          chapterTitle={chapterTitle}
          saveStatus={status}
          onToggleStructure={togglePanel}
        />
        <main className="flex-1 overflow-y-auto px-6">
          <div className="mx-auto max-w-[66ch] py-16">
            <Editor
              initialContent={data.scene.content}
              onChange={handleChange}
              onTab={openSpark}
              onReady={(editor) => {
                editorRef.current = editor;
              }}
            />
          </div>
        </main>
        {spark && (
          <SparkPalette
            context={spark.context}
            anchor={spark.anchor}
            bookTitle={data.book.title}
            chapterTitle={chapterTitle}
            sceneTitle={data.scene.title}
            onClose={closeSpark}
          />
        )}
        <EditorFooter wordsToday={wordsToday} sparkOpen={spark !== null} onSpark={toggleSpark} />
      </div>
    </div>
  );
}
