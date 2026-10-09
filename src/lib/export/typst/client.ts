import type { TypstRequest, TypstResponse, TypstResult } from "./protocol";

// One worker for the whole session, created on the first export — opening the
// app never loads Typst.
let worker: Worker | undefined;
let nextId = 1;

interface Call {
  source: string;
  /** A crashed compiler gets one more try in a fresh worker. */
  retried: boolean;
  resolve: (result: TypstResult) => void;
  reject: (error: Error) => void;
}
const pending = new Map<number, Call>();

function dropWorker() {
  worker?.terminate();
  worker = undefined;
}

function send(id: number, call: Call) {
  pending.set(id, call);
  getWorker().postMessage({ id, source: call.source } satisfies TypstRequest);
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = ({ data }: MessageEvent<TypstResponse>) => {
    const call = pending.get(data.id);
    if (!call) return;
    pending.delete(data.id);
    if (data.ok) {
      call.resolve({ pdf: data.pdf, compileMs: data.compileMs, initMs: data.initMs, bytes: data.bytes });
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

/** Typst source → PDF bytes, compiled off the main thread. */
export function compilePdf(source: string): Promise<TypstResult> {
  return new Promise((resolve, reject) => send(nextId++, { source, retried: false, resolve, reject }));
}
