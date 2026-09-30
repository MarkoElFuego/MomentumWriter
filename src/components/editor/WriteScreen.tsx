"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor as TiptapEditor, JSONContent } from "@tiptap/react";
import { SparkPalette, type SparkAnchor } from "@/components/spark/SparkPalette";
import { StructurePanel } from "@/components/structure/StructurePanel";
import { useAutosave } from "@/hooks/useAutosave";
import { useGhostText } from "@/hooks/useGhostText";
import { copy } from "@/lib/copy";
import { chapterNumber, getPart, listParts, partHeading, savePart } from "@/lib/db/parts";
import type { ID } from "@/lib/db/schema";
import { openPart, type OpenedPart } from "@/lib/db/session";
import { localDateKey, wordsDelta } from "@/lib/stats/today";
import { countWords } from "@/lib/text/countWords";
import { extractContext } from "@/lib/text/extractContext";
import { joinStarter } from "@/lib/text/joinStarter";
import { lastSentence } from "@/lib/text/lastSentence";
import { Editor } from "./Editor";
import { EditorFooter } from "./EditorFooter";
import { EditorHeader } from "./EditorHeader";
import { mainTextEnd } from "./footnotes";

// Panel open/closed survives part switches (the page remounts on each one).
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

// Gray completions on/off — a per-browser UI preference, not manuscript content.
const GHOST_KEY = "momentum:ghost";

function readGhostEnabled(): boolean {
  try {
    return localStorage.getItem(GHOST_KEY) !== "0";
  } catch {
    return true;
  }
}

function writeGhostEnabled(enabled: boolean) {
  try {
    localStorage.setItem(GHOST_KEY, enabled ? "1" : "0");
  } catch {
    // UI preference only — safe to ignore.
  }
}

interface SparkSession {
  pos: number;
  /** The document at open time — tells us whether `pos` is still valid. */
  doc: TiptapEditor["state"]["doc"];
  context: string;
  anchor: SparkAnchor | null;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "failed" }
  | { kind: "ready"; data: OpenedPart };

export function WriteScreen({ partId }: { partId: ID }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [heading, setHeading] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [panel, setPanel] = useState<{ open: boolean; autoFocus: boolean }>({
    open: false,
    autoFocus: false,
  });
  // Cursor position and context are frozen when the palette opens.
  const [spark, setSpark] = useState<SparkSession | null>(null);
  const latest = useRef<{ content: JSONContent; wordCount: number } | null>(null);
  const editorRef = useRef<TiptapEditor | null>(null);
  // State copy of the editor so hooks can subscribe once it exists.
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const [ghostEnabled, setGhostEnabled] = useState(true);

  useEffect(() => setGhostEnabled(readGhostEnabled()), []);

  const toggleGhost = useCallback(() => {
    setGhostEnabled((enabled) => {
      writeGhostEnabled(!enabled);
      return !enabled;
    });
  }, []);

  const ready = state.kind === "ready" ? state.data : null;
  const titles = useMemo(
    () =>
      ready
        ? {
            bookTitle: ready.book.title,
            language: ready.book.language,
            chapterTitle: heading,
          }
        : null,
    [ready, heading],
  );
  useGhostText(editor, ghostEnabled && spark === null, titles);

  useEffect(() => {
    let cancelled = false;
    openPart(partId, localDateKey())
      .then((data) => {
        if (cancelled) return;
        if (!data) return setState({ kind: "missing" });
        setState({ kind: "ready", data });
        setHeading(partHeading(data.part, data.chapterNumber));
        setWordCount(data.part.wordCount);
      })
      .catch((error) => {
        console.error("Failed to open part", error);
        if (!cancelled) setState({ kind: "failed" });
      });
    if (readPanelOpen()) setPanel({ open: true, autoFocus: false });
    return () => {
      cancelled = true;
    };
  }, [partId]);

  const save = useCallback(async () => {
    if (!latest.current) return;
    // Read the cursor at save time (after the debounce), not on every keystroke.
    const editor = editorRef.current;
    const cursor = editor && {
      pos: editor.state.selection.from,
      // The sentence in the prose, not in a footnote the cursor happens to be in.
      lastSentence: lastSentence(
        editor.state.doc.textBetween(0, Math.min(editor.state.selection.from, mainTextEnd(editor.state.doc)), "\n\n"),
      ),
    };
    await savePart(
      partId,
      latest.current.content,
      latest.current.wordCount,
      localDateKey(),
      cursor ?? undefined,
    );
  }, [partId]);

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
    setSpark({ pos, doc: editor.state.doc, context: extractContext(editor.state.doc, pos), anchor });
  }, []);

  const closeSpark = useCallback(() => {
    const editor = editorRef.current;
    // If the writer already clicked back into the text, don't yank the cursor.
    if (spark && editor && !editor.isFocused) {
      editor.chain().focus().setTextSelection(spark.pos).run();
    }
    setSpark(null);
  }, [spark]);

  const insertStarter = useCallback(
    (starter: string) => {
      const editor = editorRef.current;
      if (!spark || !editor) return;
      // If the writer typed while the palette was open, the frozen spot moved.
      const pos = editor.state.doc === spark.doc ? spark.pos : editor.state.selection.from;
      const text = joinStarter(editor.state.doc.textBetween(Math.max(0, pos - 1), pos), starter);
      editor
        .chain()
        .focus()
        .insertContentAt(pos, { type: "text", text })
        .setTextSelection(pos + text.length)
        .run();
      setSpark(null);
    },
    [spark],
  );

  const toggleSpark = useCallback(
    () => (spark ? closeSpark() : openSpark()),
    [spark, closeSpark, openSpark],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      // event.code keeps shortcuts working where "\" needs AltGr and "/" is
      // Shift+7 (Serbian); event.key catches Ctrl+Shift+7 there.
      if (event.key === "\\" || event.code === "Backslash") {
        event.preventDefault();
        togglePanel();
      } else if (event.key === "/" || event.code === "Slash") {
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
    // Renames and reordering can both change the heading ("Poglavlje III" → "II").
    const [part, parts] = await Promise.all([getPart(partId), listParts(state.data.book.id)]);
    if (part) setHeading(partHeading(part, chapterNumber(parts, part.id)));
  }, [state, partId]);

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
  const wordsToday = wordsDelta(data.startWordTotal, data.otherPartsTotal + wordCount);

  return (
    <div className="flex h-dvh">
      {panel.open && (
        <StructurePanel
          bookId={data.book.id}
          currentPartId={partId}
          autoFocus={panel.autoFocus}
          onNavigate={(id) => void navigate(id)}
          onClose={() => setPanelOpen(false, false)}
          onChanged={() => void refreshTitles()}
        />
      )}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <EditorHeader
          chapterTitle={heading}
          saveStatus={status}
          onToggleStructure={togglePanel}
          ghostEnabled={ghostEnabled}
          onToggleGhost={toggleGhost}
        />
        <main className="flex-1 overflow-y-auto px-6">
          <div className="mx-auto max-w-[66ch] py-16">
            <Editor
              initialContent={data.part.content}
              language={data.book.language}
              onChange={handleChange}
              onReady={(instance) => {
                editorRef.current = instance;
                setEditor(instance);
              }}
            />
          </div>
        </main>
        {spark && (
          <SparkPalette
            context={spark.context}
            anchor={spark.anchor}
            onInsert={insertStarter}
            bookTitle={data.book.title}
            language={data.book.language}
            chapterTitle={heading}
            onClose={closeSpark}
          />
        )}
        <EditorFooter wordsToday={wordsToday} sparkOpen={spark !== null} onSpark={toggleSpark} />
      </div>
    </div>
  );
}
