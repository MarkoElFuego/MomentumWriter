import type { PreviewResult, TypstRequest, TypstResponse, TypstResult } from "./protocol";

// One worker for the whole session, created on the first export — opening the
// app never loads Typst.
let worker: Worker | undefined;
let nextId = 1;
let loaded = false;

type Job = { kind: "pdf" } | { kind: "preview"; page: number };

interface Call {
  source: string;
  job: Job;
  /** A crashed compiler gets one more try in a fresh worker. */
  retried: boolean;
  resolve: (response: Extract<TypstResponse, { ok: true }>) => void;
  reject: (error: Error) => void;
}
const pending = new Map<number, Call>();

function dropWorker() {
  worker?.terminate();
  worker = undefined;
  loaded = false;
}

function send(id: number, call: Call) {
  pending.set(id, call);
  getWorker().postMessage({ id, source: call.source, ...call.job } satisfies TypstRequest);
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = ({ data }: MessageEvent<TypstResponse>) => {
    const call = pending.get(data.id);
    if (!call) return;
    pending.delete(data.id);
    if (data.ok) {
      loaded = true;
      call.resolve(data);
      return;
    }
    // typst.ts 0.7 can panic on a recompile when the text has a glyph the font lacks.
    if (data.fatal) {
      console.error("[typst] compiler crashed, starting a new one", data.error);
      const others = [...pending.entries()];
      pending.clear();
      dropWorker();
      for (const [id, other] of others) send(id, other);
      if (!call.retried) return send(data.id, { ...call, retried: true });
    }
    call.reject(new Error(data.error));
  };
  worker.onerror = (event) => {
    for (const call of pending.values()) call.reject(new Error(event.message || "Typst worker failed"));
    pending.clear();
    dropWorker();
  };
  return worker;
}

function request(source: string, job: Job): Promise<Extract<TypstResponse, { ok: true }>> {
  return new Promise((resolve, reject) => send(nextId++, { source, job, retried: false, resolve, reject }));
}

/** True once Typst has answered in this session: the next export is quick. */
export function typstLoaded(): boolean {
  return loaded;
}

/** Typst source → PDF bytes, compiled off the main thread. */
export async function compilePdf(source: string): Promise<TypstResult> {
  const response = await request(source, { kind: "pdf" });
  if (response.kind !== "pdf") throw new Error("unexpected Typst response");
  const { pdf, compileMs, initMs, bytes } = response;
  return { pdf, compileMs, initMs, bytes };
}

/** One page of the document as SVG (0-based; clamped to the document) and the page count. */
export async function previewPage(source: string, page: number): Promise<PreviewResult> {
  const response = await request(source, { kind: "preview", page });
  if (response.kind !== "preview") throw new Error("unexpected Typst response");
  const { svg, page: shown, pageCount, compileMs, initMs, bytes } = response;
  return { svg, page: shown, pageCount, compileMs, initMs, bytes };
}
