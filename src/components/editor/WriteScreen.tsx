"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorState, type Editor as TiptapEditor, type JSONContent } from "@tiptap/react";
import type { BookDetailsValue } from "@/components/book/BookDetailsFields";
import { ExportDialog } from "@/components/export/ExportDialog";
import { StructurePanel } from "@/components/structure/StructurePanel";
import { UndoToast } from "@/components/structure/UndoToast";
import { TironPanel } from "@/components/tiron/TironPanel";
import { addLaterNoteTr, laterNoteAtCursor, laterNoteRangeAt, updateLaterNoteTr, type TextRange } from "./laterNote";
import { LaterNotePopover } from "./LaterNotePopover";
import { updateStoryMemory } from "@/components/tiron/updateMemory";
import { requestWhisper } from "@/components/tiron/whisper";
import { dismissWhisper, markWhispersSeen } from "@/lib/db/whispers";
import { readTironMode, writeTironMode, type TironMode } from "@/lib/tironMode";
import { useAppearance } from "@/hooks/useAppearance";
import { useAutosave } from "@/hooks/useAutosave";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useGhostText } from "@/hooks/useGhostText";
import { usePanelsOverlay } from "@/hooks/usePanelsOverlay";
import { useOpenProofMark, useProofread } from "@/hooks/useProofread";
import { useToolbarFade } from "@/hooks/useToolbarFade";
import { offerUndo, purgeExpiredDeletes, takeUndo, useUndoDelete } from "@/hooks/useUndoDelete";
import { useLaterNotes } from "@/hooks/useLaterNotes";
import { useSessionEnd } from "@/hooks/useSessionEnd";
import { useWhispers } from "@/hooks/useWhispers";
import { useStoryMemory } from "@/hooks/useStoryMemory";
import { useStuck } from "@/hooks/useStuck";
import { useTypewriterScroll } from "@/hooks/useTypewriterScroll";
import { copy } from "@/lib/copy";
import { knownEnding, restoreBook, updateBook } from "@/lib/db/books";
import {
  chapterNumber,
  deletePart,
  getPart,
  listParts,
  partHeading,
  renamePart,
  restorePart,
  saveLanguageScore,
  savePart,
} from "@/lib/db/parts";
import { purgeProofCache } from "@/lib/db/proofCache";
import { chapterLanguageScore } from "@/lib/text/languageScore";
import type { ID, Part } from "@/lib/db/schema";
import { openPart, type OpenedPart } from "@/lib/db/session";
import { getSignals } from "@/lib/db/sessions";
import { bookPosition } from "@/lib/process/signals";
import { pagesLeft } from "@/lib/text/draftEnd";
import { localDateKey, wordsDelta } from "@/lib/stats/today";
import { countWords } from "@/lib/text/countWords";
import { lastSentence } from "@/lib/text/lastSentence";
import { ChapterTitle } from "./ChapterTitle";
import { Editor } from "./Editor";
import { EditorFooter } from "./EditorFooter";
import { EditorToolbar } from "./EditorToolbar";
import { mainTextEnd } from "./footnotes";
import { ProofPopover, type PopoverAnchor } from "./ProofPopover";
import {
  acceptDiacriticsTr,
  acceptProofTr,
  closeProofTr,
  dispatchIf,
  nextProofMarkTr,
  proofMarkCounts,
  rejectProofTr,
} from "./proofMarks";

// Panels open/closed survive part switches (the page remounts on each one).
const PANEL_KEY = "momentum:structureOpen";
const TIRON_KEY = "momentum:tironOpen";

function readPanelOpen(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writePanelOpen(key: string, open: boolean) {
  try {
    sessionStorage.setItem(key, open ? "1" : "0");
  } catch {
    // UI preference only — safe to ignore.
  }
}

// Gray completions and language check on/off — per-browser UI preferences, not manuscript content.
const GHOST_KEY = "momentum:ghost";
const PROOF_KEY = "momentum:proofread";
const HYPHENS_KEY = "momentum:hyphens";

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

type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "failed" }
  | { kind: "ready"; data: OpenedPart };

export function WriteScreen({ partId }: { partId: ID }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  // Part.title as typed above the text, and the chapter number (none for front/back matter).
  const [title, setTitle] = useState("");
  const [number, setNumber] = useState<number | undefined>(undefined);
  const titleRef = useRef<HTMLInputElement>(null);
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
  const [hyphens, setHyphens] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const pendingDelete = useUndoDelete();
  // Bumped after an undo so the open panel shows the part again.
  const [partsVersion, setPartsVersion] = useState(0);
  const [tironOpen, setTironOpen] = useState(false);
  // Srce knjige, genre and length as typed in the Knjiga section (saved on every change).
  const [bookDetails, setBookDetails] = useState<BookDetailsValue>({ heart: {} });

  useEffect(() => {
    setGhostEnabled(readEnabled(GHOST_KEY));
    setProofEnabled(readEnabled(PROOF_KEY));
    setHyphens(readEnabled(HYPHENS_KEY));
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

  const toggleHyphens = useCallback(() => {
    setHyphens((enabled) => {
      writeEnabled(HYPHENS_KEY, !enabled);
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
            chapterTitle: partHeading({ ...ready.part, title }, number),
          }
        : null,
    [ready, title, number],
  );
  const appearance = useAppearance();
  const scrollRef = useRef<HTMLElement>(null);
  useTypewriterScroll(editor, scrollRef, appearance.typewriter);
  useGhostText(editor, ghostEnabled, titles);
  const proofread = useProofread(editor, proofEnabled, ready?.book.language ?? null);
  // Live count of open underlines in this chapter ("ovde: …" in the Jezik section).
  const marksHere = useEditorState({
    editor,
    selector: ({ editor }) => (editor ? proofMarkCounts(editor.state) : null),
  });

  // Leaving the chapter: keep its language score (U7). Not while it is open —
  // and not when less than half of it has been checked.
  const saveLanguage = useCallback(() => {
    let stats;
    try {
      stats = proofread.stats();
    } catch {
      return; // The editor is already gone.
    }
    if (!stats) return;
    const score = chapterLanguageScore(stats.totalWords, stats.counts);
    if (score === null) return;
    saveLanguageScore(partId, { score, ...stats.counts }).catch((error) =>
      console.error("Failed to save the language score", error),
    );
  }, [proofread, partId]);
  const saveLanguageRef = useRef(saveLanguage);
  useEffect(() => {
    saveLanguageRef.current = saveLanguage;
  }, [saveLanguage]);
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") saveLanguageRef.current();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      // Unmount = another part, the library or Resume.
      saveLanguageRef.current();
    };
  }, []);
  const proofMark = useOpenProofMark(editor);
  const fullscreen = useFullscreen();
  const toolbarFaded = useToolbarFade(editor, toolbarRef, menuOpen, fullscreen.active);
  const probeRef = useRef<HTMLSpanElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

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
        setTitle(data.part.title);
        setNumber(data.chapterNumber);
        setWordCount(data.part.wordCount);
        setBookDetails({ heart: data.book.heart ?? {}, genre: data.book.genre, targetWords: data.book.targetWords });
        // T4: the process signals Tiron will read in T5 — visible in the dev console only.
        if (process.env.NODE_ENV === "development") {
          getSignals(data.book.id, data.part.id)
            .then((signals) => console.info("[signals]", signals))
            .catch((error) => console.error("Failed to compute the signals", error));
        }
      })
      .catch((error) => {
        console.error("Failed to open part", error);
        if (!cancelled) setState({ kind: "failed" });
      });
    if (readPanelOpen(PANEL_KEY)) setPanel({ open: true, autoFocus: false });
    setTironOpen(readPanelOpen(TIRON_KEY));
    purgeExpiredDeletes();
    purgeProofCache().catch((error) => console.error("Failed to clean the language check cache", error));
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

  const bookId = state.kind === "ready" ? state.data.book.id : null;
  const storyMemory = useStoryMemory(bookId, partId, flush);
  const stuck = useStuck(editor, titles, knownEnding(bookDetails.heart), storyMemory.compact);
  const laterNotes = useLaterNotes(editor, bookId, partId, flush);
  const whispers = useWhispers(bookId);
  useSessionEnd(bookId);
  const [tironMode, setTironMode] = useState<TironMode>("present");
  useEffect(() => setTironMode(readTironMode()), []);
  const changeTironMode = useCallback((mode: TironMode) => {
    writeTironMode(mode);
    setTironMode(mode);
  }, []);
  // An open panel has shown its whispers — no dot on T.
  useEffect(() => {
    if (tironOpen && bookId && whispers.unseen > 0) {
      markWhispersSeen(bookId).catch((error) => console.error("Failed to mark whispers seen", error));
    }
  }, [tironOpen, bookId, whispers.unseen]);
  // Ctrl/Cmd+Shift+L: „Šta ovde kasnije?” under the word — a new note, or the one the cursor is in.
  const [laterDraft, setLaterDraft] = useState<
    { anchor: PopoverAnchor; initial: string; target: { range: TextRange } | { id: string } } | null
  >(null);

  const openLaterNote = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const existing = laterNoteAtCursor(editor.state);
    const range = existing ? null : laterNoteRangeAt(editor.state);
    if (!existing && !range) return;
    try {
      const { left, top, bottom } = editor.view.coordsAtPos(range?.from ?? editor.state.selection.from);
      setLaterDraft({
        anchor: { left, top, bottom },
        initial: existing?.note ?? "",
        target: existing ? { id: existing.id } : { range: range! },
      });
    } catch {
      // Not laid out yet.
    }
  }, []);

  // No note = cancelled. Either way the cursor goes back to the text.
  const closeLaterNote = useCallback(
    (note?: string) => {
      const editor = editorRef.current;
      if (laterDraft && editor && note !== undefined) {
        const tr =
          "id" in laterDraft.target
            ? updateLaterNoteTr(editor.state, laterDraft.target.id, note)
            : addLaterNoteTr(editor.state, laterDraft.target.range, note);
        if (tr) editor.view.dispatch(tr);
      }
      setLaterDraft(null);
      editor?.commands.focus();
    },
    [laterDraft],
  );
  // Leaving the part (another part, the library, Resume): Tiron reads it in the
  // background if it has enough new words — after the last save is in.
  useEffect(
    () => () => {
      // Tiron read it → his chapter-end whisper (T5), still in the background.
      void flush()
        .then(() => updateStoryMemory(partId))
        .then((read) => (read === "updated" ? requestWhisper({ moment: "chapterEnd", partId }) : null));
    },
    [partId, flush],
  );

  const handleChange = useCallback(
    (content: JSONContent, text: string) => {
      const count = countWords(text);
      latest.current = { content, wordCount: count };
      setWordCount(count);
      schedule();
    },
    [schedule],
  );

  // Saved on every keystroke: the table of contents shows it at once, and nothing waits for a debounce.
  const changeTitle = useCallback(
    (next: string) => {
      setTitle(next);
      renamePart(partId, next).catch((error) => console.error("Failed to save the title", error));
    },
    [partId],
  );

  const setPanelOpen = useCallback((open: boolean, autoFocus: boolean) => {
    setPanel({ open, autoFocus });
    writePanelOpen(PANEL_KEY, open);
    if (!open) editorRef.current?.commands.focus();
  }, []);

  const togglePanel = useCallback(
    () => setPanelOpen(!panel.open, !panel.open),
    [panel.open, setPanelOpen],
  );

  // The Tiron panel never takes focus on opening — the author keeps writing.
  const setTironPanelOpen = useCallback((open: boolean) => {
    setTironOpen(open);
    writePanelOpen(TIRON_KEY, open);
  }, []);

  const toggleTiron = useCallback(() => setTironPanelOpen(!tironOpen), [tironOpen, setTironPanelOpen]);

  const overlay = usePanelsOverlay(probeRef, panel.open, tironOpen, state.kind === "ready");

  // Over the text, a panel closes on a click anywhere else (the toolbar has its own toggles).
  useEffect(() => {
    if (!overlay || !(panel.open || tironOpen)) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const inside = [leftPanelRef, rightPanelRef, toolbarRef].some((ref) => ref.current?.contains(target));
      if (inside) return;
      if (panel.open) setPanelOpen(false, false);
      if (tironOpen) setTironPanelOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [overlay, panel.open, tironOpen, setPanelOpen, setTironPanelOpen]);

  // Fullscreen is just the text: both panels close, and come back as they were
  // on leaving (⛶ or Esc). Refs, so the effect runs only when fullscreen changes.
  const openPanels = useRef({ left: false, right: false });
  useEffect(() => {
    openPanels.current = { left: panel.open, right: tironOpen };
  }, [panel.open, tironOpen]);
  const beforeFullscreen = useRef<{ left: boolean; right: boolean } | null>(null);
  const panelSetters = useRef({ setPanelOpen, setTironPanelOpen });
  useEffect(() => {
    panelSetters.current = { setPanelOpen, setTironPanelOpen };
  }, [setPanelOpen, setTironPanelOpen]);
  useEffect(() => {
    const setters = panelSetters.current;
    if (fullscreen.active && !beforeFullscreen.current) {
      beforeFullscreen.current = { ...openPanels.current };
      // State only: the remembered (sessionStorage) choice stays what it was before.
      setPanel({ open: false, autoFocus: false });
      setTironOpen(false);
    } else if (!fullscreen.active && beforeFullscreen.current) {
      const { left, right } = beforeFullscreen.current;
      beforeFullscreen.current = null;
      setters.setPanelOpen(left, false);
      setters.setTironPanelOpen(right);
    }
  }, [fullscreen.active]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      // event.code keeps the shortcut working where "\" needs AltGr (Serbian: "ž").
      // With Shift it is the Tiron panel on the right; without, the contents on the left.
      if (event.key === "\\" || event.key === "|" || event.code === "Backslash") {
        event.preventDefault();
        if (event.shiftKey) toggleTiron();
        else togglePanel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePanel, toggleTiron]);

  const navigate = useCallback(
    async (targetId: ID) => {
      await flush();
      router.push(`/write/${targetId}`);
    },
    [flush, router],
  );

  const refreshTitles = useCallback(async () => {
    if (state.kind !== "ready") return;
    // Renames and reordering can both change the title or the number ("III" → "II").
    const [part, parts] = await Promise.all([getPart(partId), listParts(state.data.book.id)]);
    if (!part) return;
    setTitle(part.title);
    setNumber(chapterNumber(parts, part.id));
  }, [state, partId]);

  const changeBookDetails = useCallback(
    (details: BookDetailsValue) => {
      setBookDetails(details);
      if (!bookId) return;
      updateBook(bookId, details).catch((error) => console.error("Failed to save the book details", error));
    },
    [bookId],
  );

  const removePart = useCallback(
    async (part: Part) => {
      if (!bookId) return;
      const parts = await listParts(bookId);
      const index = parts.findIndex((p) => p.id === part.id);
      // The previous part in the book, else the next one.
      const neighbour = parts[index - 1] ?? parts[index + 1];
      const wasOpen = part.id === partId;
      // Save the open text first: it must come back whole with an undo.
      if (wasOpen) await flush();
      await deletePart(part.id);
      offerUndo({ partId: part.id, kind: part.kind, wasOpen });
      if (wasOpen && neighbour) router.push(`/write/${neighbour.id}`);
      else void refreshTitles();
    },
    [bookId, partId, flush, router, refreshTitles],
  );

  const undoDelete = useCallback(async () => {
    const pending = takeUndo();
    if (!pending) return;
    // A book deleted in the library a moment before opening another one.
    if (pending.kind === "book") return restoreBook(pending.bookId);
    await restorePart(pending.partId);
    if (pending.wasOpen) {
      router.push(`/write/${pending.partId}`);
    } else {
      setPartsVersion((version) => version + 1);
      void refreshTitles();
    }
  }, [router, refreshTitles]);

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
  // T7: near the planned length, pages left (the whole book, live) — never after the draft is finished.
  const draftFinished = !!data.book.draftFinishedAt;
  const bookTotal = data.otherPartsTotal + wordCount;
  const countdown =
    !draftFinished && bookDetails.targetWords && bookPosition(bookTotal, bookDetails.targetWords) === "kraj"
      ? pagesLeft(bookTotal, bookDetails.targetWords)
      : null;

  return (
    <div className="flex h-dvh">
      {panel.open && (
        <div ref={leftPanelRef} className={overlay ? "panel-overlay panel-overlay-left" : "flex h-full shrink-0"}>
        <StructurePanel
          bookId={data.book.id}
          currentPartId={partId}
          autoFocus={panel.autoFocus}
          onNavigate={(id) => void navigate(id)}
          onClose={() => setPanelOpen(false, false)}
          currentTitle={title}
          onChanged={() => void refreshTitles()}
          onDelete={removePart}
          reloadKey={partsVersion}
        />
        </div>
      )}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <EditorToolbar
          ref={toolbarRef}
          editor={editor}
          saveStatus={status}
          // Until "Označi kraj nacrta" (T7), every book is "Nacrt 1".
          draft={!draftFinished}
          structureOpen={panel.open}
          onToggleStructure={togglePanel}
          tironOpen={tironOpen}
          onToggleTiron={toggleTiron}
          tironDot={!tironOpen && whispers.unseen > 0}
          fullscreen={fullscreen}
          appearance={appearance}
          settings={{
            ghostEnabled,
            onToggleGhost: toggleGhost,
            proofEnabled,
            onToggleProof: toggleProof,
            hyphens,
            onToggleHyphens: toggleHyphens,
            tironMode,
            onTironMode: changeTironMode,
            onFinishDraft: draftFinished
              ? undefined
              : () => {
                  void flush().then(() =>
                    router.push(`/draft-end?book=${encodeURIComponent(data.book.id)}&from=${encodeURIComponent(partId)}`),
                  );
                },
            // The export reads the book from Dexie: save what was typed a moment ago first.
            onExport: () => {
              void flush()
                .catch((error) => console.error("Failed to save before export", error))
                .then(() => setExportOpen(true));
            },
          }}
          faded={toolbarFaded}
          onMenuOpenChange={setMenuOpen}
        />
        <main
          ref={scrollRef}
          className={`flex-1 overflow-y-auto px-6${appearance.focusMode ? " focus-mode" : ""}${hyphens ? " hyphenate" : ""}`}
        >
          {/* 60 characters in the text font: when the panels leave less room than this, they go over the text. */}
          <span ref={probeRef} aria-hidden="true" className="ch-probe">
            {"0".repeat(60)}
          </span>
          {/* Typewriter: room below the last line so it can reach the middle too. */}
          <div className={`mx-auto max-w-[66ch] pt-10 ${appearance.typewriter ? "pb-[50vh]" : "pb-16"}`}>
            <ChapterTitle
              ref={titleRef}
              title={title}
              number={number}
              onChange={changeTitle}
              onLeave={() => editorRef.current?.commands.focus("start")}
            />
            <Editor
              initialContent={data.part.content}
              language={data.book.language}
              // The first chapter of a book that has no words yet.
              draftHint={!draftFinished && data.chapterNumber === 1 && data.otherPartsTotal === 0 && data.part.wordCount === 0}
              onChange={handleChange}
              onLaterNote={openLaterNote}
              onExitTop={() => {
                const input = titleRef.current;
                if (!input) return;
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
              }}
              onReady={(instance) => {
                editorRef.current = instance;
                setEditor(instance);
              }}
            />
          </div>
        </main>
        {laterDraft && (
          <LaterNotePopover
            anchor={laterDraft.anchor}
            initial={laterDraft.initial}
            onSave={(note) => closeLaterNote(note)}
            onCancel={() => closeLaterNote()}
          />
        )}
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
        <EditorFooter wordsToday={wordsToday} faded={toolbarFaded} />
        <UndoToast pending={pendingDelete} onUndo={() => void undoDelete()} />
        {exportOpen && (
          <ExportDialog
            bookId={data.book.id}
            onClose={() => {
              setExportOpen(false);
              editorRef.current?.commands.focus();
            }}
          />
        )}
      </div>
      {tironOpen && (
        <div ref={rightPanelRef} className={overlay ? "panel-overlay panel-overlay-right" : "flex h-full shrink-0"}>
        <TironPanel
          whispers={whispers}
          onDismissWhisper={(id) => void dismissWhisper(id).catch((error) => console.error("Failed to dismiss the whisper", error))}
          stuck={stuck.state}
          book={bookDetails}
          onBookChange={changeBookDetails}
          bookId={data.book.id}
          memory={storyMemory.memory}
          summaries={storyMemory.summaries}
          refreshState={storyMemory.refreshState}
          onRefresh={() => void storyMemory.refresh()}
          countdown={countdown}
          laterNotes={laterNotes.notes}
          onGoToNote={(note) => void laterNotes.goTo(note)}
          onTickOffNote={laterNotes.tickOff}
          language={
            data.book.languageScore
              ? {
                  ...data.book.languageScore,
                  here: marksHere && marksHere.diacritics + marksHere.grammar > 0 ? marksHere : null,
                }
              : null
          }
          onNextMark={() => {
            const editor = editorRef.current;
            if (editor) dispatchIf(editor.view, nextProofMarkTr(editor.state));
          }}
          onStuck={() => void stuck.ask()}
          onClose={() => setTironPanelOpen(false)}
          // ProseMirror keeps the selection while unfocused; focus() puts the cursor back there.
          onBackToText={() => editorRef.current?.commands.focus()}
        />
        </div>
      )}
    </div>
  );
}
