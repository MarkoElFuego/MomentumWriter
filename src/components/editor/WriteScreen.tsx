"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor as TiptapEditor, JSONContent } from "@tiptap/react";
import { StructurePanel } from "@/components/structure/StructurePanel";
import { useAppearance } from "@/hooks/useAppearance";
import { useAutosave } from "@/hooks/useAutosave";
import { useGhostText } from "@/hooks/useGhostText";
import { useOpenProofMark, useProofread } from "@/hooks/useProofread";
import { useTypewriterScroll } from "@/hooks/useTypewriterScroll";
import { copy } from "@/lib/copy";
import { chapterNumber, getPart, listParts, partHeading, savePart } from "@/lib/db/parts";
import type { ID } from "@/lib/db/schema";
import { openPart, type OpenedPart } from "@/lib/db/session";
import { localDateKey, wordsDelta } from "@/lib/stats/today";
import { countWords } from "@/lib/text/countWords";
import { lastSentence } from "@/lib/text/lastSentence";
import { docFromJSON, restorablePos } from "./contentSchema";
import { Editor } from "./Editor";
import { EditorFooter } from "./EditorFooter";
import { EditorHeader } from "./EditorHeader";
import { mainTextEnd } from "./footnotes";
import { ProofPopover, type PopoverAnchor } from "./ProofPopover";
import { acceptDiacriticsTr, acceptProofTr, closeProofTr, dispatchIf, rejectProofTr } from "./proofMarks";

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

// Gray completions and language check on/off — per-browser UI preferences, not manuscript content.
const GHOST_KEY = "momentum:ghost";
const PROOF_KEY = "momentum:proofread";

function readEnabled(key: string): boolean {
  try {
    return localStorage.getItem(key) !== "0";
  } catch {
    return true;
  }
}

function writeEnabled(key: string, enabled: boolean) {
  try {
    localStorage.setItem(key, enabled ? "1" : "0");
  } catch {
    // UI preference only — safe to ignore.
  }
}

// Back to where the author stopped, if this is the part last written in.
function savedCursor({ part, book, resumeCursor }: OpenedPart): number | undefined {
  if (resumeCursor === undefined) return undefined;
  try {
    return restorablePos(docFromJSON(part.content, book.language), resumeCursor);
  } catch {
    // Content the schema can't read — the editor will report it; start at the end.
    return undefined;
  }
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
  const latest = useRef<{ content: JSONContent; wordCount: number } | null>(null);
  const editorRef = useRef<TiptapEditor | null>(null);
  // State copy of the editor so hooks can subscribe once it exists.
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const [ghostEnabled, setGhostEnabled] = useState(true);
  const [proofEnabled, setProofEnabled] = useState(true);

  useEffect(() => {
    setGhostEnabled(readEnabled(GHOST_KEY));
    setProofEnabled(readEnabled(PROOF_KEY));
  }, []);

  const toggleGhost = useCallback(() => {
    setGhostEnabled((enabled) => {
      writeEnabled(GHOST_KEY, !enabled);
      return !enabled;
    });
  }, []);

  const toggleProof = useCallback(() => {
    setProofEnabled((enabled) => {
      writeEnabled(PROOF_KEY, !enabled);
      return !enabled;
    });
  }, []);

  const ready = state.kind === "ready" ? state.data : null;
  // Parsed once per open, not on every keystroke.
  const initialCursor = useMemo(() => (ready ? savedCursor(ready) : undefined), [ready]);
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
  const appearance = useAppearance();
  const scrollRef = useRef<HTMLElement>(null);
  useTypewriterScroll(editor, scrollRef, appearance.typewriter);
  useGhostText(editor, ghostEnabled, titles);
  useProofread(editor, proofEnabled, ready?.book.language ?? null);
  const proofMark = useOpenProofMark(editor);

  const closeProof = useCallback((refocus: boolean) => {
    const editor = editorRef.current;
    if (!editor) return;
    dispatchIf(editor.view, closeProofTr(editor.state));
    if (refocus) editor.commands.focus();
  }, []);

  // Accept / reject / accept all, then back to the text.
  const resolveProof = useCallback(
    (build: typeof acceptProofTr) => {
      const editor = editorRef.current;
      if (!editor || !proofMark) return;
      dispatchIf(editor.view, build(editor.state, proofMark.id));
      editor.commands.focus();
    },
    [proofMark],
  );

  let proofAnchor: PopoverAnchor | null = null;
  if (proofMark && editor) {
    try {
      const { left, top, bottom } = editor.view.coordsAtPos(proofMark.from);
      proofAnchor = { left, top, bottom };
    } catch {
      // Not laid out yet — no popover this render.
    }
  }

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      // event.code keeps the shortcut working where "\" needs AltGr (Serbian: "ž").
      if (event.key === "\\" || event.code === "Backslash") {
        event.preventDefault();
        togglePanel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePanel]);

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
          proofEnabled={proofEnabled}
          onToggleProof={toggleProof}
          appearance={appearance}
        />
        <main
          ref={scrollRef}
          className={`flex-1 overflow-y-auto px-6${appearance.focusMode ? " focus-mode" : ""}`}
        >
          {/* Typewriter: room below the last line so it can reach the middle too. */}
          <div className={`mx-auto max-w-[66ch] pt-16 ${appearance.typewriter ? "pb-[50vh]" : "pb-16"}`}>
            <Editor
              initialContent={data.part.content}
              initialCursor={initialCursor}
              language={data.book.language}
              onChange={handleChange}
              onReady={(instance) => {
                editorRef.current = instance;
                setEditor(instance);
              }}
            />
          </div>
        </main>
        {proofMark && proofAnchor && (
          <ProofPopover
            mark={proofMark}
            anchor={proofAnchor}
            onAccept={() => resolveProof(acceptProofTr)}
            onReject={() => resolveProof(rejectProofTr)}
            onAcceptDiacritics={() => resolveProof(acceptDiacriticsTr)}
            onClose={closeProof}
          />
        )}
        <EditorFooter wordsToday={wordsToday} />
      </div>
    </div>
  );
}
