"use client";

import { useEffect, useState } from "react";
import { listBooks } from "@/lib/db/books";
import { listParts } from "@/lib/db/parts";
import type { Book } from "@/lib/db/schema";
import { buildBook } from "@/lib/export/typst/buildBook";
import { compilePdf } from "@/lib/export/typst/client";
import { bookSource, probeSource } from "@/lib/export/typst/probe";
import { manuscriptTemplate } from "@/lib/export/typst/templates/manuscript.typ";
import { PRINT_SIZES, printTemplate, type PrintSize } from "@/lib/export/typst/templates/print.typ";

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
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState("");
  const [size, setSize] = useState<PrintSize>("a5");
  const [toc, setToc] = useState(false);
  const [author, setAuthor] = useState("");
  const [contact, setContact] = useState("");
  const [spacing, setSpacing] = useState<1.5 | 2>(1.5);
  const add = (line: string) => setLog((lines) => [...lines, line]);

  useEffect(() => {
    void listBooks().then((list) => {
      setBooks(list);
      setBookId((id) => id || list[0]?.id || "");
    });
  }, []);

  // The author's own book through both templates (P2: every print size, optional contents; P3: author, contact, spacing).
  async function exportBook(kind: "print" | "manuscript") {
    const book = books.find((b) => b.id === bookId);
    if (!book) return;
    const model = buildBook(book, await listParts(book.id));
    const source = kind === "print" ? printTemplate(model, { size, toc }) : manuscriptTemplate(model, { author, contact, spacing });
    console.log(`[typst] ${kind}`, source);
    await run(`${book.title}-${kind === "print" ? size : "rukopis"}`, () => source);
  }

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
      {books.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <select value={bookId} onChange={(e) => setBookId(e.target.value)} className="rounded border border-muted/40 bg-paper px-2 py-1">
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
          <select value={size} onChange={(e) => setSize(e.target.value as PrintSize)} className="rounded border border-muted/40 bg-paper px-2 py-1">
            {PRINT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={toc} onChange={(e) => setToc(e.target.checked)} />
            Sadržaj
          </label>
          <button type="button" disabled={busy} className="ui-button rounded border border-muted/40 px-3 py-1" onClick={() => void exportBook("print")}>
            Knjiga za štampu
          </button>
          <button type="button" disabled={busy} className="ui-button rounded border border-muted/40 px-3 py-1" onClick={() => void exportBook("manuscript")}>
            Rukopis A4
          </button>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Ime autora" className="rounded border border-muted/40 bg-paper px-2 py-1" />
          <textarea value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Kontakt (red po red)" rows={2} className="rounded border border-muted/40 bg-paper px-2 py-1" />
          <select value={spacing} onChange={(e) => setSpacing(Number(e.target.value) as 1.5 | 2)} className="rounded border border-muted/40 bg-paper px-2 py-1">
            <option value={1.5}>prored 1,5</option>
            <option value={2}>dupli prored</option>
          </select>
        </div>
      )}
      <ul className="mt-6 space-y-1 font-mono text-xs">
        {busy && <li className="text-muted">Slažem…</li>}
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </main>
  );
}
