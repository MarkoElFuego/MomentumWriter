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

interface SparkPaletteProps {
  context: string;
  bookTitle: string;
  chapterTitle: string;
  sceneTitle: string;
  onClose: () => void;
}

export function SparkPalette({ context, bookTitle, chapterTitle, sceneTitle, onClose }: SparkPaletteProps) {
  const [view, setView] = useState<View>({ kind: "menu" });
  const rootRef = useRef<HTMLDivElement>(null);
  const firstToolRef = useRef<HTMLButtonElement>(null);
  const againRef = useRef<HTMLButtonElement>(null);
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
    else if (view.kind === "result" || view.kind === "error") againRef.current?.focus();
    else rootRef.current?.focus();
  }, [view.kind]);

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
      className="absolute bottom-16 right-6 z-30 w-[min(24rem,calc(100%-3rem))] rounded-md border border-muted/30 bg-paper p-2 text-sm shadow-sm outline-none"
      onKeyDown={(event) => {
        if (view.kind !== "menu") return;
        const tool = TOOLS[Number(event.key) - 1];
        if (tool && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          void run(tool);
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
            {view.kind === "loading" && <Skeleton lines={view.tool === "push" ? 3 : 1} />}
            {view.kind === "result" && <Cards data={view.data} />}
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

function Skeleton({ lines }: { lines: number }) {
  return (
    <div className="flex flex-col gap-2" aria-label={copy.spark.loading}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-14 rounded-md bg-muted/15 motion-safe:animate-pulse" />
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

// Read-only on purpose: nothing here can be inserted into the manuscript.
function Cards({ data }: { data: SparkResponse }) {
  return (
    <div className="flex flex-col gap-2">
      {"items" in data &&
        data.items.map((item) => (
          <Card key={item.kind} label={copy.spark.kinds[item.kind]}>
            {item.text}
          </Card>
        ))}
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
