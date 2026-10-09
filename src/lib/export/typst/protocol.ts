/** Served from public/ (scripts/copy-typst-assets.mjs copies the WASM there). */
export const TYPST_WASM_URL = "/typst/typst_ts_web_compiler_bg.wasm";
export const FONT_URLS = ["Regular", "Italic", "Bold", "BoldItalic"].map((s) => `/fonts/literata/Literata-${s}.ttf`);

/** Messages between the page and the Typst worker. */
export interface TypstRequest {
  id: number;
  source: string;
}

export type TypstResponse =
  | {
      id: number;
      ok: true;
      pdf: Uint8Array;
      compileMs: number;
      /** Only on the first compile: loading the WASM and fonts. */
      initMs?: number;
      /** Only on the first compile: bytes over the network (0 when cached or unknown). */
      bytes?: number;
    }
  | {
      id: number;
      ok: false;
      error: string;
      /** The compiler crashed (a Typst panic); the worker must be replaced. */
      fatal: boolean;
    };

export type TypstResult = Omit<Extract<TypstResponse, { ok: true }>, "id" | "ok">;
