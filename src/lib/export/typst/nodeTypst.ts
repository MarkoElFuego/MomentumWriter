// The real Typst compiler in Node — the same WASM and fonts the browser uses —
// for tests and scripts/measure-typst.ts. Never imported by the app.
import { readFileSync } from "node:fs";
import { createTypstCompiler, type TypstCompiler } from "@myriaddreamin/typst.ts/compiler";
import { loadFonts } from "@myriaddreamin/typst.ts/dist/esm/options.init.mjs";

export const WASM_PATH = "node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm";
export const FONT_PATHS = ["Regular", "Italic", "Bold", "BoldItalic"].map((s) => `public/fonts/literata/Literata-${s}.ttf`);

let compiler: Promise<TypstCompiler> | undefined;

export function nodeTypst(): Promise<TypstCompiler> {
  compiler ??= (async () => {
    const c = createTypstCompiler();
    await c.init({
      getModule: () => new Uint8Array(readFileSync(WASM_PATH)),
      beforeBuild: [loadFonts(FONT_PATHS.map((f) => new Uint8Array(readFileSync(f))), { assets: false })],
    });
    return c;
  })();
  return compiler;
}

interface Diagnostic {
  severity: string;
  message: string;
}

export interface TypstRun {
  errors: string[];
  warnings: string[];
  /** Query results, when a selector was given and the document compiled. */
  query?: unknown[];
}

/** Compiles `source` (layout included); optionally queries the result (`field` of each match, or whole elements). */
export async function runTypst(source: string, selector?: string, field?: string): Promise<TypstRun> {
  const c = await nodeTypst();
  c.addSource("/main.typ", source);
  return c.runWithWorld({ mainFilePath: "/main.typ" }, async (world) => {
    const result = await world.compile({ diagnostics: "full" });
    const diagnostics = (result.diagnostics ?? []) as unknown as Diagnostic[];
    const errors = diagnostics.filter((d) => d.severity === "error").map((d) => d.message);
    if (result.hasError && !errors.length) errors.push("compile failed");
    const warnings = diagnostics.filter((d) => d.severity !== "error").map((d) => d.message);
    const query = selector && !result.hasError ? await world.query({ selector, ...(field ? { field } : {}) }) : undefined;
    return { errors, warnings, query };
  });
}

/** Typst content (as JSON from a query) → the text a reader would see. */
export function contentText(node: unknown): string {
  if (Array.isArray(node)) return node.map(contentText).join("");
  if (!node || typeof node !== "object") return "";
  const n = node as { func?: string; text?: string; children?: unknown[]; body?: unknown };
  switch (n.func) {
    case "text":
    case "symbol":
      return n.text ?? "";
    case "space":
      return " ";
    case "linebreak":
      return "\n";
    case "parbreak":
      return "\n\n";
    case "sequence":
      return contentText(n.children ?? []);
    default:
      // A smart quote or any other element shows up by name, so a test sees it.
      return n.body !== undefined ? contentText(n.body) : `<${n.func}>`;
  }
}
