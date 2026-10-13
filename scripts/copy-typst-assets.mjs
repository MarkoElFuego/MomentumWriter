// Copies the Typst compiler and renderer WASM from node_modules to public/typst/ (ZADATAK_IZVOZ:
// hosted locally, never from a CDN), and the pdf.js worker to public/pdfjs/ (ZADATAK_UVOZ I4:
// reading a PDF). Runs before dev and build; public/typst/ and public/pdfjs/ are not in git.
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const root = (pkg) => dirname(require.resolve(`${pkg}/package.json`));
// [from, to]: the compiler, the renderer that draws preview pages (P4), the PDF reader's worker.
const FILES = [
  [join(root("@myriaddreamin/typst-ts-web-compiler"), "pkg", "typst_ts_web_compiler_bg.wasm"), join("public", "typst", "typst_ts_web_compiler_bg.wasm")],
  [join(root("@myriaddreamin/typst-ts-renderer"), "pkg", "typst_ts_renderer_bg.wasm"), join("public", "typst", "typst_ts_renderer_bg.wasm")],
  [join(root("pdfjs-dist"), "build", "pdf.worker.min.mjs"), join("public", "pdfjs", "pdf.worker.min.mjs")],
];

for (const [from, to] of FILES) {
  const same = (() => {
    try {
      const a = statSync(from);
      const b = statSync(to);
      return a.size === b.size && b.mtimeMs >= a.mtimeMs;
    } catch {
      return false;
    }
  })();

  if (!same) {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    console.log(`[assets] ${to}`);
  }
}
