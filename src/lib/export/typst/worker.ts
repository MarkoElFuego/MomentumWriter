// Typst compiler in a Web Worker (ZADATAK_IZVOZ P0): the 27 MB WASM and the fonts
// load only on the first request, from public/ — no CDN, works offline.
import { createTypstCompiler, type TypstCompiler } from "@myriaddreamin/typst.ts/compiler";
import { loadFonts } from "@myriaddreamin/typst.ts/dist/esm/options.init.mjs";
import { FONT_URLS, TYPST_WASM_URL, type TypstRequest, type TypstResponse } from "./protocol";

interface WorkerScope {
  onmessage: ((event: MessageEvent<TypstRequest>) => void) | null;
  postMessage(message: TypstResponse, transfer?: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;

let ready: Promise<{ compiler: TypstCompiler; initMs: number; bytes: number }> | undefined;

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function init() {
  const start = performance.now();
  const [wasm, ...fonts] = await Promise.all([fetchBytes(TYPST_WASM_URL), ...FONT_URLS.map(fetchBytes)]);
  const compiler = createTypstCompiler();
  await compiler.init({
    getModule: () => wasm,
    // assets: false — never the library's default fonts from a CDN.
    beforeBuild: [loadFonts(fonts, { assets: false })],
  });
  // Bytes over the network (compressed), when the browser reports them.
  const bytes = performance
    .getEntriesByType("resource")
    .reduce((sum, entry) => sum + ((entry as PerformanceResourceTiming).transferSize || 0), 0);
  return { compiler, initMs: Math.round(performance.now() - start), bytes };
}

scope.onmessage = async ({ data }) => {
  try {
    const firstRun = !ready;
    ready ??= init();
    const { compiler, initMs, bytes } = await ready;
    compiler.addSource("/main.typ", data.source);
    const start = performance.now();
    const result = await compiler.compile({ mainFilePath: "/main.typ", format: 1, diagnostics: "full" });
    const compileMs = Math.round(performance.now() - start);
    // Never hand out an empty PDF: no result means the source did not compile.
    if (!result.result) throw new Error(JSON.stringify(result.diagnostics ?? "no result"));
    const pdf = result.result;
    scope.postMessage(
      { id: data.id, ok: true, pdf, compileMs, ...(firstRun ? { initMs, bytes } : {}) },
      [pdf.buffer as ArrayBuffer],
    );
  } catch (error) {
    // A failed init is retried on the next request.
    if (error instanceof Error && error.message.includes("/typst/")) ready = undefined;
    // A Rust panic leaves the WASM instance unusable: only a new worker helps.
    const fatal = error instanceof WebAssembly.RuntimeError;
    scope.postMessage({ id: data.id, ok: false, fatal, error: error instanceof Error ? error.message : String(error) });
  }
};
