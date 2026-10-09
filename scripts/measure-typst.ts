// P0 (ZADATAK_IZVOZ): compiles the trial sources with the same WASM and fonts
// the browser uses, and prints sizes and times. `pnpm measure:typst [outDir]`
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { FONT_PATHS, WASM_PATH, nodeTypst } from "../src/lib/export/typst/nodeTypst";
import { bookSource, probeSource } from "../src/lib/export/typst/probe";

const outDir = process.argv[2] ?? ".";
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;

async function main() {
  const wasm = readFileSync(WASM_PATH);
  console.log(`WASM ${mb(wasm.length)} (gzip ${mb(gzipSync(wasm).length)})`);
  console.log(`Fontovi ${mb(FONT_PATHS.reduce((sum, f) => sum + readFileSync(f).length, 0))}`);

  const t = performance.now();
  const compiler = await nodeTypst();
  console.log(`Init (WASM + fontovi) ${Math.round(performance.now() - t)} ms`);

  async function compile(name: string, source: string) {
    compiler.addSource("/main.typ", source);
    const start = performance.now();
    const result = await compiler.compile({ mainFilePath: "/main.typ", format: 1, diagnostics: "full" });
    const ms = Math.round(performance.now() - start);
    if (!result.result) throw new Error(`${name}: ${JSON.stringify(result.diagnostics, null, 2)}`);
    writeFileSync(join(outDir, `${name}.pdf`), result.result);
    console.log(`${name}: ${ms} ms, PDF ${mb(result.result.length)}`);
  }

  await compile("proba", probeSource());
  const book = bookSource();
  console.log(`Knjiga: ${book.split(/\s+/).length} reči u izvoru`);
  await compile("knjiga-80k", book);
  await compile("knjiga-80k-ponovo", book);
}

void main();
