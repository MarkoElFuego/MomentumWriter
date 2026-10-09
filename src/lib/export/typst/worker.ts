// Typst compiler in a Web Worker (ZADATAK_IZVOZ P0): the 27 MB WASM and the fonts
// load only on the first request, from public/ — no CDN, works offline.
// P4: the renderer (1 MB) draws single pages as SVG for the preview.
import { createTypstCompiler, type TypstCompiler } from "@myriaddreamin/typst.ts/compiler";
import { createTypstRenderer, type TypstRenderer } from "@myriaddreamin/typst.ts/renderer";
import { loadFonts } from "@myriaddreamin/typst.ts/dist/esm/options.init.mjs";
import { FONT_URLS, RENDERER_WASM_URL, TYPST_WASM_URL, type TypstRequest, type TypstResponse } from "./protocol";
import { pageSvg } from "./pageSvg";

interface WorkerScope {
  onmessage: ((event: MessageEvent<TypstRequest>) => void) | null;
  postMessage(message: TypstResponse, transfer?: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;

let ready: Promise<{ compiler: TypstCompiler; initMs: number; bytes: number }> | undefined;
let renderer: Promise<TypstRenderer> | undefined;
/** The last preview's compiled document: turning pages does not compile again. */
let lastVector: { source: string; vector: Uint8Array } | undefined;

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

async function initRenderer() {
  const wasm = await fetchBytes(RENDERER_WASM_URL);
  const r = createTypstRenderer();
  await r.init({ getModule: () => wasm });
  return r;
}

/** Compiles to PDF (1) or to the renderer's vector format (0); never returns an empty result. */
async function compile(compiler: TypstCompiler, source: string, format: 0 | 1) {
  compiler.addSource("/main.typ", source);
  const start = performance.now();
  const result = await compiler.compile({ mainFilePath: "/main.typ", format, diagnostics: "full" });
  if (!result.result) throw new Error(JSON.stringify(result.diagnostics ?? "no result"));
  return { bytes: result.result, compileMs: Math.round(performance.now() - start) };
}

scope.onmessage = async ({ data }) => {
  try {
    const firstRun = !ready;
    ready ??= init();
    const { compiler, initMs, bytes } = await ready;
    const first = firstRun ? { initMs, bytes } : {};

    if (data.kind === "pdf") {
      const { bytes: pdf, compileMs } = await compile(compiler, data.source, 1);
      scope.postMessage({ id: data.id, ok: true, kind: "pdf", pdf, compileMs, ...first }, [pdf.buffer as ArrayBuffer]);
      return;
    }

    renderer ??= initRenderer();
    const r = await renderer;
    let compileMs = 0;
    if (lastVector?.source !== data.source) {
      const result = await compile(compiler, data.source, 0);
      lastVector = { source: data.source, vector: result.bytes };
      compileMs = result.compileMs;
    }
    const vector = lastVector.vector;
    const preview = await r.runWithSession(async (session) => {
      r.manipulateData({ renderSession: session, action: "reset", data: vector });
      const pages = r.retrievePagesInfoFromSession(session);
      if (!pages.length) throw new Error("no pages");
      const page = Math.min(Math.max(data.page, 0), pages.length - 1);
      // Pages are stacked top to bottom; the window picks one of them.
      const top = pages.slice(0, page).reduce((sum, p) => sum + p.height, 0);
      const { width, height } = pages[page]!;
      const svg = await r.renderSvg({
        renderSession: session,
        window: { lo: { x: 0, y: top }, hi: { x: width, y: top + height } },
      });
      return { svg: pageSvg(svg, top, width, height), page, pageCount: pages.length };
    });
    scope.postMessage({ id: data.id, ok: true, kind: "preview", ...preview, compileMs, ...first });
  } catch (error) {
    // A failed init is retried on the next request.
    if (error instanceof Error && error.message.includes("/typst/")) {
      if (error.message.includes(RENDERER_WASM_URL)) renderer = undefined;
      else ready = undefined;
    }
    // A Rust panic leaves the WASM instance unusable: only a new worker helps.
    const fatal = error instanceof WebAssembly.RuntimeError;
    scope.postMessage({ id: data.id, ok: false, fatal, error: error instanceof Error ? error.message : String(error) });
  }
};
