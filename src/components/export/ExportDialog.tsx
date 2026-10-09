"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copy } from "@/lib/copy";
import { getBook, updateBook } from "@/lib/db/books";
import { listParts } from "@/lib/db/parts";
import type { Book, ID, Part } from "@/lib/db/schema";
import { kdpFileName, pdfFileName } from "@/lib/export/fileName";
import { KDP_TRIMS, kdpChecks, layoutForKdp } from "@/lib/export/kdp";
import { buildBook } from "@/lib/export/typst/buildBook";
import { compilePdf, previewPage, typstLoaded } from "@/lib/export/typst/client";
import { manuscriptTemplate } from "@/lib/export/typst/templates/manuscript.typ";
import {
  COVER_STYLES,
  PRINT_SIZES,
  printTemplate,
  type CoverStyle,
  type PrintSize,
} from "@/lib/export/typst/templates/print.typ";

// Izvoz (ZADATAK_IZVOZ P4): the author picks where the book goes, sees its first
// pages and downloads the PDF — all in the browser, no print dialog.

const PREVIEW_DELAY_MS = 400;

type Destination = "print" | "kdp" | "manuscript";
const DESTINATIONS: Destination[] = ["print", "kdp", "manuscript"];

interface ExportDialogProps {
  bookId: ID;
  onClose: () => void;
}

interface Preview {
  svg: string;
  page: number;
  pageCount: number;
}

export function ExportDialog({ bookId, onClose }: ExportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<{ book: Book; parts: Part[] }>();
  const [destination, setDestination] = useState<Destination>("print");
  const [size, setSize] = useState<PrintSize>("a5");
  const [toc, setToc] = useState(false);
  const [cover, setCover] = useState<CoverStyle>("classic");
  const [kdpTrimId, setKdpTrimId] = useState("6x9");
  /** KDP: the layout after the margin passes, and the settings it was made for. */
  const [kdp, setKdp] = useState<{ key: string; source: string; pages: number }>();
  const [laying, setLaying] = useState(false);
  const [spacing, setSpacing] = useState<1.5 | 2>(1.5);
  /** Rukopis: Word file (recommended) or PDF (P7). */
  const [format, setFormat] = useState<"docx" | "pdf">("docx");
  const [author, setAuthor] = useState("");
  const [contact, setContact] = useState("");
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<Preview>();
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // The book as saved a moment ago (the editor flushes before opening this).
  useEffect(() => {
    let alive = true;
    void Promise.all([getBook(bookId), listParts(bookId)])
      .then(([book, parts]) => {
        if (!alive || !book) return;
        setData({ book, parts });
        setAuthor(book.author ?? "");
        setContact(book.contact ?? "");
      })
      .catch((error) => {
        console.error("[export] failed to load the book", error);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [bookId]);

  // The whole book once; typing the author's name only changes the template around it.
  const model = useMemo(() => (data ? buildBook(data.book, data.parts) : undefined), [data]);
  const fixedSource = useMemo(() => {
    if (!model || destination === "kdp") return undefined;
    return destination === "print"
      ? printTemplate(model, { size, toc, cover, author })
      : manuscriptTemplate(model, { author, contact, spacing });
  }, [model, destination, size, toc, cover, author, contact, spacing]);

  // KDP: the inside margin depends on the page count — lay out in passes (in the
  // worker), after a pause in the changes. The last layout stays shown meanwhile.
  const kdpTrim = KDP_TRIMS.find((trim) => trim.id === kdpTrimId) ?? KDP_TRIMS[3]!;
  const kdpKey = JSON.stringify([kdpTrimId, toc, cover, author]);
  useEffect(() => {
    if (!model || destination !== "kdp") return;
    let current = true;
    setLaying(true);
    const timer = setTimeout(() => {
      layoutForKdp(
        (layout) => printTemplate(model, { size: "a5", layout, toc, cover, author }),
        kdpTrim,
        async (candidate) => (await previewPage(candidate, 0)).pageCount,
      )
        .then((result) => {
          if (current) setKdp({ key: kdpKey, source: result.source, pages: result.pages });
        })
        .catch((error) => {
          console.error("[export] KDP layout failed", error);
          if (current) setFailed(true);
        })
        .finally(() => {
          if (current) setLaying(false);
        });
    }, PREVIEW_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [model, destination, kdpTrim, kdpKey, toc, cover, author]);
  const source = destination === "kdp" ? kdp?.source : fixedSource;
  const kdpReady = destination === "kdp" && kdp?.key === kdpKey && !laying;

  // Preview: a changed setting waits for a pause in the changes; turning a page
  // does not wait (the worker keeps the compiled book). A newer request wins.
  const shownSource = useRef<string>(undefined);
  useEffect(() => {
    if (!source) return;
    let current = true;
    setLoading(true);
    // A KDP layout has already waited for its pause.
    const delay = source === shownSource.current || destination === "kdp" ? 0 : PREVIEW_DELAY_MS;
    const timer = setTimeout(() => {
      shownSource.current = source;
      previewPage(source, page)
        .then((result) => {
          if (!current) return;
          setPreview(result);
          setFailed(false);
          if (result.page !== page) setPage(result.page);
        })
        .catch((error) => {
          console.error("[export] preview failed", error);
          if (current) setFailed(true);
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, delay);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [source, page, destination]);

  const download = useCallback(async () => {
    if (!source || !data || downloading || (destination === "kdp" && !kdpReady)) return;
    setDownloading(true);
    try {
      if (destination === "manuscript" && format === "docx") {
        // Loaded only now: the Word library never slows down the editor.
        const [{ Packer }, { manuscriptDocx }] = await Promise.all([import("docx"), import("@/lib/export/docx/manuscriptDocx")]);
        if (!model) return;
        const blob = await Packer.toBlob(manuscriptDocx(model, { author, contact, spacing }));
        save(blob, pdfFileName(data.book.title, { author }).replace(/\.pdf$/, ".docx"));
        setFailed(false);
        return;
      }
      const { pdf } = await compilePdf(source);
      const name =
        destination === "kdp"
          ? kdpFileName(data.book.title, kdpTrimId)
          : pdfFileName(data.book.title, destination === "manuscript" ? { author } : undefined);
      save(new Blob([pdf as BlobPart], { type: "application/pdf" }), name);
      setFailed(false);
    } catch (error) {
      console.error("[export] PDF failed", error);
      setFailed(true);
    } finally {
      setDownloading(false);
    }
  }, [source, data, destination, author, downloading, kdpReady, kdpTrimId, format, model, contact, spacing]);

  // Author and contact belong to the book: the next manuscript remembers them.
  const saveAuthor = (value: string) => {
    setAuthor(value);
    void updateBook(bookId, { author: value });
  };
  const saveContact = (value: string) => {
    setContact(value);
    void updateBook(bookId, { contact: value });
  };

  const turn = (delta: number) => {
    if (!preview) return;
    setPage((p) => Math.min(Math.max(p + delta, 0), preview.pageCount - 1));
  };

  function onKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
    const target = event.target as HTMLElement;
    // In a text field the arrows move the cursor; among the cover styles they pick one.
    const typing = target instanceof HTMLInputElement && (target.type === "text" || target.type === "radio");
    const inArea = target instanceof HTMLTextAreaElement;
    if (event.key === "Enter" && !inArea && !(target instanceof HTMLButtonElement) && !(target instanceof HTMLSelectElement)) {
      event.preventDefault();
      void download();
    } else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !typing && !inArea && !(target instanceof HTMLSelectElement)) {
      // Arrows on the destination cards move between them (radio group); elsewhere they turn pages.
      if (target.getAttribute("role") === "radio") return;
      event.preventDefault();
      turn(event.key === "ArrowLeft" ? -1 : 1);
    }
  }

  function onCardKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const next = DESTINATIONS[(index + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + DESTINATIONS.length) % DESTINATIONS.length]!;
    setDestination(next);
    document.getElementById(`export-${next}`)?.focus();
  }

  const t = copy.export;
  const label = "block text-xs text-muted";
  const status = failed
    ? t.failed
    : (loading || laying) && !typstLoaded()
      ? t.preparing
      : destination === "kdp" && laying
        ? t.kdp.laying
        : "";
  const checks =
    destination === "kdp" && kdp && data ? kdpChecks({ pages: kdp.pages, trim: kdpTrim, title: data.book.title, author }) : [];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="export-title"
      className="export-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={onKeyDown}
    >
      <div className="flex max-h-[92dvh] flex-col gap-6 overflow-y-auto p-6 md:flex-row">
        <section className="flex w-full shrink-0 flex-col md:w-72">
          <h2 id="export-title" className="font-serif text-xl">
            {t.title}
          </h2>
          <div role="radiogroup" aria-label={t.destinationLabel} className="mt-5 space-y-2">
            {DESTINATIONS.map((d, i) => (
              <button
                key={d}
                id={`export-${d}`}
                type="button"
                role="radio"
                aria-checked={destination === d}
                tabIndex={destination === d ? 0 : -1}
                autoFocus={destination === d}
                className={`export-card${destination === d ? " export-card-on" : ""}`}
                onClick={() => setDestination(d)}
                onKeyDown={(event) => onCardKeyDown(event, i)}
              >
                <span className="block text-ink">{t.destinations[d].name}</span>
                <span className="mt-0.5 block text-xs text-muted">{t.destinations[d].hint}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-4 text-sm">
            {/* One name for both: the cover and the manuscript's title page. */}
            <div>
              <label htmlFor="export-author" className={label}>
                {t.author}
              </label>
              <input
                id="export-author"
                type="text"
                value={author}
                onChange={(e) => saveAuthor(e.target.value)}
                className="book-field mt-0.5"
              />
            </div>
            {destination !== "manuscript" ? (
              <>
                <div>
                  <label htmlFor="export-size" className={label}>
                    {t.size}
                  </label>
                  {destination === "print" ? (
                    <select id="export-size" value={size} onChange={(e) => setSize(e.target.value as PrintSize)} className="book-select mt-1">
                      {PRINT_SIZES.map((s) => (
                        <option key={s} value={s}>
                          {t.sizes[s]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select id="export-size" value={kdpTrimId} onChange={(e) => setKdpTrimId(e.target.value)} className="book-select mt-1">
                      {[true, false].map((common) => (
                        <optgroup key={String(common)} label={common ? t.kdp.commonSizes : t.kdp.otherSizes}>
                          {KDP_TRIMS.filter((trim) => Boolean(trim.common) === common).map((trim) => (
                            <option key={trim.id} value={trim.id}>
                              {t.kdp.trimName(trim.width, trim.height)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  )}
                </div>
                <fieldset>
                  <legend className={label}>{t.cover}</legend>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {COVER_STYLES.map((style) => (
                      <label key={style} className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="export-cover"
                          value={style}
                          checked={cover === style}
                          onChange={() => {
                            setCover(style);
                            // Show the result right away.
                            setPage(0);
                          }}
                        />
                        {t.covers[style]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={toc} onChange={(e) => setToc(e.target.checked)} />
                  {t.toc}
                </label>
                {checks.length > 0 && kdp && (
                  <div className={kdpReady ? "" : "opacity-60"}>
                    <p className={label}>{t.kdp.checksLabel}</p>
                    <ul className="mt-1 space-y-1 text-xs">
                      {checks.map((check) => (
                        <li key={check.text} className={`flex gap-1.5 ${check.ok ? "text-muted" : "text-ink"}`}>
                          <span aria-hidden="true">{check.ok ? "✓" : "⚠"}</span>
                          {check.text}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-muted">{t.kdp.cover(kdp.pages)}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <fieldset>
                  <legend className={label}>{t.format}</legend>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {(["docx", "pdf"] as const).map((f) => (
                      <label key={f} className="flex items-center gap-1.5">
                        <input type="radio" name="export-format" value={f} checked={format === f} onChange={() => setFormat(f)} />
                        {t.formats[f]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label htmlFor="export-contact" className={label}>
                    {t.contact}
                  </label>
                  <textarea
                    id="export-contact"
                    rows={2}
                    value={contact}
                    placeholder={t.contactPlaceholder}
                    onChange={(e) => saveContact(e.target.value)}
                    className="book-field mt-0.5 resize-none"
                  />
                </div>
                <div>
                  <label htmlFor="export-spacing" className={label}>
                    {t.spacing}
                  </label>
                  <select
                    id="export-spacing"
                    value={spacing}
                    onChange={(e) => setSpacing(Number(e.target.value) as 1.5 | 2)}
                    className="book-select mt-1"
                  >
                    <option value={1.5}>{t.spacings.oneHalf}</option>
                    <option value={2}>{t.spacings.double}</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="mt-auto flex items-center gap-4 pt-8">
            <button
              type="button"
              className="book-start px-4 py-2"
              disabled={!source || downloading || (destination === "kdp" && !kdpReady)}
              onClick={() => void download()}
            >
              {downloading ? t.downloading : destination === "manuscript" && format === "docx" ? t.downloadDocx : t.download}
            </button>
            <button type="button" className="ui-button text-sm" onClick={onClose}>
              {t.close}
            </button>
          </div>
          <p role="status" aria-live="polite" className="mt-3 min-h-5 text-xs text-muted">
            {status}
          </p>
        </section>

        <section aria-label={t.previewLabel} className="flex min-w-0 flex-1 flex-col items-center">
          <div className={`export-page${loading && preview ? " export-page-busy" : ""}`}>
            {/* Typst's own SVG of the author's text (escaped by Typst): no scripts run from innerHTML. */}
            {preview && <div dangerouslySetInnerHTML={{ __html: preview.svg }} />}
          </div>
          {destination === "manuscript" && format === "docx" && <p className="mt-3 text-xs text-muted">{t.docxPreviewNote}</p>}
          {preview && (
            <div className="mt-3 flex items-center gap-4 text-sm text-muted">
              <button type="button" className="ui-button px-2" aria-label={t.previousPage} disabled={page === 0} onClick={() => turn(-1)}>
                ←
              </button>
              <span>{t.pageOf(preview.page + 1, preview.pageCount)}</span>
              <button
                type="button"
                className="ui-button px-2"
                aria-label={t.nextPage}
                disabled={page >= preview.pageCount - 1}
                onClick={() => turn(1)}
              >
                →
              </button>
            </div>
          )}
        </section>
      </div>
    </dialog>
  );
}

/** Hands a file to the browser's downloads. */
function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Give the browser a moment to start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
