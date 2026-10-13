"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { continueImportReading } from "@/components/tiron/importReading";
import { copy } from "@/lib/copy";
import { importBook } from "@/lib/db/importBook";
import { toLatin } from "@/lib/import/cyrillic";
import { ACCEPTED_FILES, ImportError, prepare, readFile, readPaste, type ImportSource } from "@/lib/import/read";
import { mergeWithPrevious, titlePagePart, type ImportedPart } from "@/lib/import/splitBook";

// Uvoz (ZADATAK_UVOZ I3): a file or a paste → how Momentum split the book →
// „Uvezi knjigu” → Srce knjige → writing. Everything stays in the browser; the
// text goes to the AI only if Tiron is asked to read the book.

interface ImportDialogProps {
  onClose: () => void;
}

const t = copy.import;

/** Lets "Čitam rukopis…" show before the reading blocks the page for a moment. */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

function failure(error: unknown): string {
  if (error instanceof ImportError) return t.errors[error.reason];
  console.error("[import] reading failed", error);
  return t.readFailed;
}

export function ImportDialog({ onClose }: ImportDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<ImportSource | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [latin, setLatin] = useState(true);
  const [keepTitlePage, setKeepTitlePage] = useState(false);
  const [tironReads, setTironReads] = useState(true);
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  /** The parts as the author left them, and the earlier versions „Vrati” goes back to. */
  const [parts, setParts] = useState<ImportedPart[]>([]);
  const [history, setHistory] = useState<ImportedPart[][]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const useLatin = Boolean(source?.warnings.cyrillic && latin);
  const split = useMemo(() => (source ? prepare(source, useLatin) : null), [source, useLatin]);

  // A new split (another source, Latin on or off) starts the list over.
  useEffect(() => {
    if (!split || !source) return;
    setParts(split.parts);
    setHistory([]);
    if (!titleEdited) {
      const suggestion = source.title ?? split.titlePage?.title ?? source.fileName ?? "";
      setTitle(useLatin ? toLatin(suggestion) : suggestion);
    }
  }, [split, source, useLatin, titleEdited]);

  async function read(load: () => Promise<ImportSource> | ImportSource, name: (source: ImportSource) => string) {
    setReading(true);
    setError("");
    await nextFrame();
    try {
      const next = await load();
      setTitleEdited(false);
      setKeepTitlePage(false);
      setSource(next);
      setSourceName(name(next));
    } catch (problem) {
      setError(failure(problem));
    } finally {
      setReading(false);
    }
  }

  const pickFile = (file: File | undefined) => {
    if (file) void read(() => readFile(file), (next) => t.fromFile(file.name, next.words));
  };

  const paste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    // The pasted text is never shown — a whole novel would slow the page down.
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    void read(() => readPaste(html, text), (next) => t.pasted(next.words));
  };

  const merge = (index: number) => {
    setHistory((past) => [...past, parts]);
    setParts(mergeWithPrevious(parts, index));
  };

  const undoMerge = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setParts(previous);
    setHistory(history.slice(0, -1));
  };

  const startImport = async () => {
    if (!split || importing) return;
    setImporting(true);
    setError("");
    try {
      const all = keepTitlePage && split.titlePage ? [titlePagePart(split.titlePage), ...parts] : parts;
      const { book } = await importBook({ title, parts: all, tironReads });
      // In the background while the author answers Srce knjige; a closed tab goes on next time.
      if (tironReads) void continueImportReading(book.id);
      router.push(`/start?book=${book.id}`);
    } catch (problem) {
      console.error("[import] import failed", problem);
      setError(t.failed);
      setImporting(false);
    }
  };

  const chapters = parts.filter((part) => part.kind === "chapter");
  const others = parts.filter((part) => part.kind !== "chapter" && part.title).map((part) => part.title);
  const totalWords = parts.reduce((sum, part) => sum + part.words, 0);
  const warnings = source?.warnings;
  const label = "block text-xs text-muted";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="import-title"
      className="export-dialog import-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        if (event.key === "Enter" && split && !(target instanceof HTMLButtonElement) && !(target instanceof HTMLTextAreaElement)) {
          event.preventDefault();
          void startImport();
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        pickFile(event.dataTransfer.files[0]);
      }}
    >
      <div className="flex max-h-[92dvh] flex-col overflow-y-auto p-6">
        <h2 id="import-title" className="font-serif text-xl">
          {t.title}
        </h2>
        <p className="mt-1 text-sm text-muted">{t.intro}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="import-source">
            <button type="button" autoFocus className="ui-button border border-muted/40 px-4 py-2" disabled={reading} onClick={() => fileRef.current?.click()}>
              {t.chooseFile}
            </button>
            <p className="mt-2 text-xs text-muted">{t.fileTypes}</p>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_FILES}
              className="hidden"
              onChange={(event) => {
                pickFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
          <label className="import-source">
            <span className={label}>{t.pasteLabel}</span>
            <textarea
              rows={2}
              value=""
              readOnly={reading}
              placeholder={t.pastePlaceholder}
              className="book-field mt-1 resize-none"
              onChange={() => undefined}
              onPaste={paste}
            />
          </label>
        </div>

        <p role="status" aria-live="polite" className="mt-3 min-h-5 text-xs text-muted">
          {reading ? t.reading : error || (source ? sourceName : "")}
        </p>

        {split && source && !reading && (
          <section aria-label={t.partsLabel} className="mt-2 space-y-4 text-sm">
            <div>
              <label htmlFor="import-book-title" className={label}>
                {t.bookTitle}
              </label>
              <input
                id="import-book-title"
                type="text"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setTitleEdited(true);
                }}
                className="book-field mt-0.5 font-serif"
              />
            </div>

            <p className="text-ink">{t.summary(chapters.length, others, totalWords)}</p>
            {!split.recognized && <p className="text-muted">{t.nothingFound}</p>}

            <div>
              <div className="flex items-baseline justify-between">
                <h3 className={label}>{t.partsLabel}</h3>
                {history.length > 0 && (
                  <button type="button" className="ui-button text-xs underline" onClick={undoMerge}>
                    {t.undoMerge}
                  </button>
                )}
              </div>
              <ol className="import-parts mt-1">
                {parts.map((part, index) => {
                  const number = part.kind === "chapter" ? chapters.indexOf(part) + 1 : 0;
                  const name = number ? copy.structure.chapterLabel(number, part.title) : part.title || copy.structure.untitledPart;
                  return (
                    <li key={index} className="flex items-baseline gap-3 py-1.5">
                      <span className="min-w-0 flex-1">
                        <span className="text-ink">{name}</span>
                        {part.kind === "chapter" && (
                          <span className="text-muted">
                            {" · "}
                            {t.partWords(part.words)}
                            {part.firstSentence && <> · „{part.firstSentence.length > 60 ? `${part.firstSentence.slice(0, 60).trimEnd()}…` : part.firstSentence}”</>}
                          </span>
                        )}
                      </span>
                      {index > 0 && (
                        <button
                          type="button"
                          className="ui-button shrink-0 text-xs text-muted"
                          aria-label={t.mergeLabel(name)}
                          onClick={() => merge(index)}
                        >
                          {t.merge}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            {split.titlePage && (
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={keepTitlePage} onChange={(event) => setKeepTitlePage(event.target.checked)} />
                <span>
                  {t.keepTitlePage}
                  <span className="block text-xs text-muted">„{split.titlePage.title}”</span>
                </span>
              </label>
            )}

            {warnings?.cyrillic && (
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={latin} onChange={(event) => setLatin(event.target.checked)} />
                <span>
                  {t.latin}
                  {!latin && <span className="block text-xs text-muted">{t.cyrillicNote}</span>}
                </span>
              </label>
            )}

            {warnings && (warnings.images > 0 || warnings.tables > 0 || warnings.plainFootnotes > 0 || warnings.pdfFootnotes) && (
              <ul className="space-y-1 text-xs text-muted">
                {warnings.images > 0 && <li>{t.warnings.images(warnings.images)}</li>}
                {warnings.tables > 0 && <li>{t.warnings.tables}</li>}
                {warnings.plainFootnotes > 0 && <li>{t.warnings.plainFootnotes(warnings.plainFootnotes)}</li>}
                {warnings.pdfFootnotes && <li>{t.warnings.pdfFootnotes}</li>}
              </ul>
            )}

            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={tironReads} onChange={(event) => setTironReads(event.target.checked)} />
              <span>
                {t.tironReads}
                <span className="block text-xs text-muted">{t.tironReadsHint}</span>
              </span>
            </label>
          </section>
        )}

        <div className="mt-8 flex items-center gap-4">
          <button type="button" className="book-start px-4 py-2" disabled={!split || reading || importing} onClick={() => void startImport()}>
            {importing ? t.importing : t.import}
          </button>
          <button type="button" className="ui-button text-sm" onClick={onClose}>
            {t.cancel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
