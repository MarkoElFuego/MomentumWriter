import type { TypstRequest, TypstResponse, TypstResult } from "./protocol";

// One worker for the whole session, created on the first export — opening the
// app never loads Typst.
let worker: Worker | undefined;
let nextId = 1;
const pending = new Map<number, { resolve: (r: TypstResult) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = ({ data }: MessageEvent<TypstResponse>) => {
    const call = pending.get(data.id);
    if (!call) return;
    pending.delete(data.id);
    if (data.ok) {
      call.resolve({ pdf: data.pdf, compileMs: data.compileMs, initMs: data.initMs, bytes: data.bytes });
    } else {
      call.reject(new Error(data.error));
    }
  };
  worker.onerror = (event) => {
    for (const call of pending.values()) call.reject(new Error(event.message || "Typst worker failed"));
    pending.clear();
    worker?.terminate();
    worker = undefined;
  };
  return worker;
}

/** Typst source → PDF bytes, compiled off the main thread. */
export function compilePdf(source: string): Promise<TypstResult> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, source } satisfies TypstRequest);
  });
}
