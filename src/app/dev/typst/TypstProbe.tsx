"use client";

import { useState } from "react";
import { compilePdf } from "@/lib/export/typst/client";
import { bookSource, probeSource } from "@/lib/export/typst/probe";

// Dev-only measuring page (P0); its text is for the developer, so it stays out of copy.ts.

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;

function download(pdf: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TypstProbe() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const add = (line: string) => setLog((lines) => [...lines, line]);

  async function run(name: string, source: () => string) {
    setBusy(true);
    const started = performance.now();
    try {
      const result = await compilePdf(source());
      const total = Math.round(performance.now() - started);
      if (result.initMs !== undefined) {
        add(`Prvo učitavanje (WASM + fontovi): ${result.initMs} ms, preko mreže ${mb(result.bytes ?? 0)}`);
      }
      add(`${name}: kompajliranje ${result.compileMs} ms, ukupno ${total} ms, PDF ${mb(result.pdf.length)}`);
      download(result.pdf, `${name}.pdf`);
    } catch (error) {
      console.error("[typst]", error);
      add(`${name}: GREŠKA — detalj u konzoli`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-sm">
      <h1 className="mb-6 text-lg">Typst proba (P0)</h1>
      <div className="flex gap-3">
        <button type="button" disabled={busy} className="ui-button rounded border border-muted/40 px-3 py-1" onClick={() => void run("proba", probeSource)}>
          Proba (1 strana)
        </button>
        <button
          type="button"
          disabled={busy}
          className="ui-button rounded border border-muted/40 px-3 py-1"
          onClick={() => void run("knjiga-80k", () => bookSource())}
        >
          Knjiga 80.000 reči
        </button>
      </div>
      <ul className="mt-6 space-y-1 font-mono text-xs">
        {busy && <li className="text-muted">Slažem…</li>}
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </main>
  );
}
