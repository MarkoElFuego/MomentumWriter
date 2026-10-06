"use client";

import { useId } from "react";
import { copy } from "@/lib/copy";
import { GENRES, TARGET_WORDS, type BookHeart, type Genre } from "@/lib/db/schema";

export interface BookDetailsValue {
  heart: BookHeart;
  genre?: Genre;
  targetWords?: number;
}

interface BookDetailsFieldsProps {
  value: BookDetailsValue;
  onChange: (value: BookDetailsValue) => void;
  /** "page": the start screen; "panel": the Knjiga section in the right panel. */
  variant: "page" | "panel";
  autoFocus?: boolean;
}

/**
 * Enter in a one-line field goes on to the next field; Ctrl/Cmd+Enter submits.
 * Put on the element that holds all the fields.
 */
export function handleFieldKeys(event: React.KeyboardEvent<HTMLElement>, onSubmit: () => void) {
  if (event.key !== "Enter" || event.altKey || event.shiftKey) return;
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    onSubmit();
    return;
  }
  const target = event.target as HTMLElement;
  if (!(target instanceof HTMLInputElement)) return;
  event.preventDefault();
  const fields = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("input, textarea, select"));
  fields[fields.indexOf(target) + 1]?.focus();
}

/** Srce knjige (three questions), genre and rough length — all optional. */
export function BookDetailsFields({ value, onChange, variant, autoFocus = false }: BookDetailsFieldsProps) {
  const id = useId();
  const page = variant === "page";
  const label = page ? "block text-sm text-muted" : "block text-xs text-muted";
  const field = page ? "book-field mt-1 font-serif text-lg" : "book-field mt-0.5 font-serif text-sm";
  const gap = page ? "mt-8" : "mt-4";

  const setHeart = (key: keyof BookHeart, text: string) => onChange({ ...value, heart: { ...value.heart, [key]: text } });

  return (
    <>
      <label htmlFor={`${id}-about`} className={label}>
        {copy.book.about}
      </label>
      <input
        id={`${id}-about`}
        type="text"
        autoFocus={autoFocus}
        lang="sr-Latn"
        spellCheck
        className={field}
        value={value.heart.about ?? ""}
        onChange={(event) => setHeart("about", event.target.value)}
      />

      <label htmlFor={`${id}-ending`} className={`${label} ${gap}`}>
        {copy.book.ending}
      </label>
      <textarea
        id={`${id}-ending`}
        rows={2}
        lang="sr-Latn"
        spellCheck
        placeholder={copy.book.endingPlaceholder}
        className={field}
        value={value.heart.ending ?? ""}
        onChange={(event) => setHeart("ending", event.target.value)}
      />

      <label htmlFor={`${id}-why`} className={`${label} ${gap}`}>
        {copy.book.why}
      </label>
      <textarea
        id={`${id}-why`}
        rows={2}
        lang="sr-Latn"
        spellCheck
        className={field}
        value={value.heart.why ?? ""}
        onChange={(event) => setHeart("why", event.target.value)}
      />

      <div className={`${gap} flex flex-wrap gap-x-6 gap-y-4`}>
        <div>
          <label htmlFor={`${id}-genre`} className={label}>
            {copy.book.genre}
          </label>
          <select
            id={`${id}-genre`}
            className={`book-select mt-1 ${page ? "" : "text-sm"}`}
            value={value.genre ?? ""}
            onChange={(event) => onChange({ ...value, genre: (event.target.value || undefined) as Genre | undefined })}
          >
            <option value="">{copy.book.noGenre}</option>
            {GENRES.map((genre) => (
              <option key={genre} value={genre}>
                {copy.book.genres[genre]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-length`} className={label}>
            {copy.book.length}
          </label>
          <select
            id={`${id}-length`}
            className={`book-select mt-1 ${page ? "" : "text-sm"}`}
            value={value.targetWords ?? ""}
            onChange={(event) =>
              onChange({ ...value, targetWords: event.target.value ? Number(event.target.value) : undefined })
            }
          >
            <option value="">{copy.book.lengthUnknown}</option>
            {TARGET_WORDS.map((words) => (
              <option key={words} value={words}>
                {copy.book.lengths[words]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
