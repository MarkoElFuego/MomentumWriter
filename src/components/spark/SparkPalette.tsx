"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SparkResponse } from "@/lib/ai/schemas";
import { requestSpark, type SparkClientError } from "@/lib/ai/sparkClient";
import { copy } from "@/lib/copy";

// Resume ("↩ Vrati me u priču") joins in Phase 4.
const TOOLS = ["push", "complicate", "missing"] as const;
type Tool = (typeof TOOLS)[number];

type View =
  | { kind: "menu" }
  | { kind: "empty" }
  | { kind: "loading"; tool: Tool }
  | { kind: "result"; tool: Tool; data: SparkResponse }
  | { kind: "error"; tool: Tool; error: SparkClientError };

// Viewport coordinates of the cursor line (ProseMirror coordsAtPos).
export interface SparkAnchor {
  left: number;
  top: number;
  bottom: number;
}

const WIDTH = 384;
const GAP = 8;
const EDGE = 16;
// Roughly the height of three cards plus actions.
const ROOM_BELOW = 300;

// Just under the cursor line, or above it when the line is near the bottom.
function placeAt(anchor: SparkAnchor): React.CSSProperties {
  const width = Math.min(WIDTH, window.innerWidth - 2 * EDGE);
  const left = Math.min(Math.max(anchor.left, EDGE), window.innerWidth - width - EDGE);
  return window.innerHeight - anchor.bottom >= ROOM_BELOW
    ? { position: "fixed", left, top: anchor.bottom + GAP, width }
    : { position: "fixed", left, bottom: window.innerHeight - anchor.top + GAP, width };
}

interface SparkPaletteProps {
  context: string;
  anchor: SparkAnchor | null;
  bookTitle: string;
  chapterTitle: string;
  sceneTitle: string;
  /** Push only: the author picked a starter; the palette closes afterwards. */
  onInsert: (starter: string) => void;
  onClose: () => void;
}

export function SparkPalette({
  context,
  anchor,
  bookTitle,
  chapterTitle,
  sceneTitle,
  onInsert,
  onClose,
}: SparkPaletteProps) {
  const [view, setView] = useState<View>({ kind: "menu" });
  const rootRef = useRef<HTMLDivElement>(null);
  const firstToolRef = useRef<HTMLButtonElement>(null);
  const againRef = useRef<HTMLButtonElement>(null);
  const firstStarterRef = useRef<HTMLButtonElement>(null);
  const request = useRef<AbortController | null>(null);

  const run = useCallback(
    async (tool: Tool) => {
      if (context.trim() === "") return setView({ kind: "empty" });
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setView({ kind: "loading", tool });

      const body = { mode: tool, context, bookTitle, chapterTitle, sceneTitle };
      const result = await requestSpark(body, controller.signal);
      if (controller.signal.aborted) return;
      setView(
        result.ok
          ? { kind: "result", tool, data: result.data }
          : { kind: "error", tool, error: result.error },
      );
    },
    [context, bookTitle, chapterTitle, sceneTitle],
  );

  // Drop any in-flight request when the palette closes.
  useEffect(() => () => request.current?.abort(), []);

  // Keep keyboard focus inside the palette as its content changes.
  useEffect(() => {
    if (view.kind === "menu") firstToolRef.current?.focus();
    else if (view.kind === "result") (firstStarterRef.current ?? againRef.current)?.focus();
    else if (view.kind === "error") againRef.current?.focus();
    else rootRef.current?.focus();
  }, [view]);

  // Window-level so Esc works even while focus sits on the loading skeleton.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={copy.spark.dialogLabel}
      tabIndex={-1}
      style={anchor ? placeAt(anchor) : undefined}
      className={`z-30 rounded-md border border-muted/30 bg-paper p-2 text-sm shadow-sm outline-none ${
        anchor ? "" : "absolute bottom-16 right-6 w-[min(24rem,calc(100%-3rem))]"
      }`}
      onKeyDown={(event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const index = Number(event.key) - 1;
        if (view.kind === "menu" && TOOLS[index]) {
          event.preventDefault();
          void run(TOOLS[index]);
        } else if (view.kind === "result" && "items" in view.data && view.data.items[index]) {
          event.preventDefault();
          onInsert(view.data.items[index].text);
        }
      }}
    >
      {view.kind === "menu" && (
        <ul className="flex flex-col">
          {TOOLS.map((tool, i) => (
            <li key={tool}>
              <button
                ref={i === 0 ? firstToolRef : undefined}
                type="button"
                className="ui-button flex w-full justify-between px-3 py-2 text-left"
                aria-keyshortcuts={String(i + 1)}
                onClick={() => void run(tool)}
              >
                <span>{copy.spark.tools[tool]}</span>
                <span className="opacity-70">{i + 1}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {view.kind === "empty" && (
        <div className="px-3 py-2">
          <p className="text-muted">{copy.spark.empty}</p>
          <Actions onClose={onClose} onBack={() => setView({ kind: "menu" })} />
        </div>
      )}

      {view.kind !== "menu" && view.kind !== "empty" && (
        <div className="px-1 py-1">
          <p className="px-2 pb-2 text-muted">{copy.spark.tools[view.tool]}</p>
          <div aria-live="polite" aria-busy={view.kind === "loading"}>
            {view.kind === "loading" && <Skeleton lines={view.tool === "push" ? 3 : 1} short={view.tool === "push"} />}
            {view.kind === "result" &&
              ("items" in view.data ? (
                <Starters items={view.data.items} firstRef={firstStarterRef} onPick={onInsert} />
              ) : (
                <Cards data={view.data} />
              ))}
            {view.kind === "error" && <p className="px-2 py-2 text-muted">{copy.spark.errors[view.error]}</p>}
          </div>
          {view.kind !== "loading" && (
            <Actions
              againRef={againRef}
              onAgain={() => void run(view.tool)}
              onBack={() => setView({ kind: "menu" })}
              onClose={onClose}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Skeleton({ lines, short = false }: { lines: number; short?: boolean }) {
  return (
    <div className="flex flex-col gap-2" aria-label={copy.spark.loading}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={`${short ? "h-9" : "h-14"} rounded-md bg-muted/15 motion-safe:animate-pulse`}
        />
      ))}
    </div>
  );
}

function Card({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-muted/20 px-3 py-2 leading-relaxed text-ink">
      {label && <p className="pb-1 text-xs uppercase tracking-wider text-muted">{label}</p>}
      {children}
    </div>
  );
}

type StarterItem = SparkResponse<"push">["items"][number];

// The only AI text that may enter the manuscript: a short starter the author finishes.
function Starters({
  items,
  firstRef,
  onPick,
}: {
  items: StarterItem[];
  firstRef: React.Ref<HTMLButtonElement>;
  onPick: (starter: string) => void;
}) {
  return (
    <div>
      <p className="px-2 pb-2 text-xs text-muted">{copy.spark.starterHint}</p>
      <ul className="flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={item.kind}>
            <button
              ref={i === 0 ? firstRef : undefined}
              type="button"
              className="ui-button flex w-full items-baseline gap-3 rounded-md border border-muted/20 px-3 py-2 text-left"
              aria-keyshortcuts={String(i + 1)}
              onClick={() => onPick(item.text)}
            >
              <span className="opacity-70">{i + 1}</span>
              <span className="flex-1 font-serif text-base text-ink">…{item.text}</span>
              <span className="text-xs uppercase tracking-wider">{copy.spark.kinds[item.kind]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Editorial notes are read-only on purpose: they can never enter the manuscript.
function Cards({ data }: { data: Exclude<SparkResponse, SparkResponse<"push">> }) {
  return (
    <div className="flex flex-col gap-2">
      {"observation" in data && (
        <Card>
          <p>{data.observation}</p>
          <p className="pt-1">{data.question}</p>
        </Card>
      )}
      {"question" in data && !("observation" in data) && <Card>{data.question}</Card>}
    </div>
  );
}

interface ActionsProps {
  againRef?: React.Ref<HTMLButtonElement>;
  onAgain?: () => void;
  onBack: () => void;
  onClose: () => void;
}

function Actions({ againRef, onAgain, onBack, onClose }: ActionsProps) {
  return (
    <div className="flex justify-end gap-1 pt-2">
      {onAgain && (
        <button ref={againRef} type="button" className="ui-button px-2 py-1" onClick={onAgain}>
          {copy.spark.again}
        </button>
      )}
      <button type="button" className="ui-button px-2 py-1" onClick={onBack}>
        {copy.spark.back}
      </button>
      <button type="button" className="ui-button px-2 py-1" onClick={onClose}>
        {copy.spark.close}
      </button>
    </div>
  );
}
