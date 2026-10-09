// Copies the Typst compiler and renderer WASM from node_modules to public/typst/ (ZADATAK_IZVOZ:
// hosted locally, never from a CDN). Runs before dev and build; public/typst/ is not in git.
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
// The compiler, and the renderer that draws preview pages (P4).
const FILES = [
  ["@myriaddreamin/typst-ts-web-compiler", "typst_ts_web_compiler_bg.wasm"],
  ["@myriaddreamin/typst-ts-renderer", "typst_ts_renderer_bg.wasm"],
];

for (const [pkg, name] of FILES) {
  const from = join(dirname(require.resolve(`${pkg}/package.json`)), "pkg", name);
  const to = join("public", "typst", name);

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
    console.log(`[typst] ${to}`);
  }
}
