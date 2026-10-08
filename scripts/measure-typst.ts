// P0 (ZADATAK_IZVOZ): compiles the trial sources with the same WASM and fonts
// the browser uses, and prints sizes and times. `pnpm exec tsx scripts/measure-typst.ts [outDir]`
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { createTypstCompiler } from "@myriaddreamin/typst.ts/compiler";
import { loadFonts } from "@myriaddreamin/typst.ts/dist/esm/options.init.mjs";
import { bookSource, probeSource } from "../src/lib/export/typst/probe";

const outDir = process.argv[2] ?? ".";
const wasmPath = "node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm";
const fontFiles = ["Regular", "Italic", "Bold", "BoldItalic"].map((s) => `public/fonts/literata/Literata-${s}.ttf`);

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;
const wasm = readFileSync(wasmPath);
const fonts = fontFiles.map((f) => new Uint8Array(readFileSync(f)));
console.log(`WASM ${mb(wasm.length)} (gzip ${mb(gzipSync(wasm).length)})`);
console.log(`Fontovi ${mb(fonts.reduce((s, f) => s + f.length, 0))}`);

async function main() {
let t = performance.now();
const compiler = createTypstCompiler();
await compiler.init({
  getModule: () => new Uint8Array(wasm),
  beforeBuild: [loadFonts(fonts, { assets: false })],
});
console.log(`Init (WASM + fontovi) ${Math.round(performance.now() - t)} ms`);

async function compile(name: string, source: string) {
  compiler.addSource("/main.typ", source);
  const start = performance.now();
  const result = await compiler.compile({ mainFilePath: "/main.typ", format: 1, diagnostics: "full" });
  const ms = Math.round(performance.now() - start);
  if (!result.result) throw new Error(`${name}: ${JSON.stringify(result.diagnostics, null, 2)}`);
  if (result.diagnostics?.length) console.log(`${name} upozorenja:`, JSON.stringify(result.diagnostics));
  writeFileSync(join(outDir, `${name}.pdf`), result.result);
  console.log(`${name}: ${ms} ms, PDF ${mb(result.result.length)}`);
}

await compile("proba", probeSource());
const book = bookSource();
console.log(`Knjiga: ${book.split(/\s+/).length} reči u izvoru`);
await compile("knjiga-80k", book);
t = performance.now();
await compile("knjiga-80k-ponovo", book);
}

void main();
