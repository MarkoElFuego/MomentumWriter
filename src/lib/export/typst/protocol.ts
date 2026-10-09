/** Served from public/ (scripts/copy-typst-assets.mjs copies the WASM there). */
export const TYPST_WASM_URL = "/typst/typst_ts_web_compiler_bg.wasm";
export const RENDERER_WASM_URL = "/typst/typst_ts_renderer_bg.wasm";
export const FONT_URLS = ["Regular", "Italic", "Bold", "BoldItalic"].map((s) => `/fonts/literata/Literata-${s}.ttf`);

/** Messages between the page and the Typst worker: the whole PDF, or one page to look at. */
export type TypstRequest = { id: number; source: string } & ({ kind: "pdf" } | { kind: "preview"; page: number });

interface Timing {
  compileMs: number;
  /** Only on the first compile: loading the WASM and fonts. */
  initMs?: number;
  /** Only on the first compile: bytes over the network (0 when cached or unknown). */
  bytes?: number;
}

export type TypstResponse =
  | ({ id: number; ok: true; kind: "pdf"; pdf: Uint8Array } & Timing)
  | ({
      id: number;
      ok: true;
      kind: "preview";
      /** One page as SVG; `page` is clamped to the document. */
      svg: string;
      page: number;
      pageCount: number;
    } & Timing)
  | {
      id: number;
      ok: false;
      error: string;
      /** The compiler crashed (a Typst panic); the worker must be replaced. */
      fatal: boolean;
    };

export type TypstResult = Omit<Extract<TypstResponse, { kind: "pdf" }>, "id" | "ok" | "kind">;
export type PreviewResult = Omit<Extract<TypstResponse, { kind: "preview" }>, "id" | "ok" | "kind">;
