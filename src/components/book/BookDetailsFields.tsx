"use client";

import { useId, useRef } from "react";
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

      {/* POL4: tags instead of the system's drop-down menus. */}
      <p id={`${id}-genre`} className={`${label} ${gap}`}>
        {copy.book.genre}
      </p>
      <ChipChoice
        labelledBy={`${id}-genre`}
        options={GENRES.map((genre) => ({ value: genre as Genre | undefined, label: copy.book.genres[genre] }))}
        value={value.genre}
        // The genre can be taken back: a click on the chosen one clears it.
        clearable
        onChange={(genre) => onChange({ ...value, genre })}
      />
      <p id={`${id}-length`} className={`${label} ${page ? "mt-6" : "mt-3"}`}>
        {copy.book.length}
      </p>
      <ChipChoice
        labelledBy={`${id}-length`}
        options={[
          ...TARGET_WORDS.map((words) => ({ value: words as number | undefined, label: copy.book.lengthChips[words]! })),
          { value: undefined, label: copy.book.lengthUnknownChip },
        ]}
        value={value.targetWords}
        onChange={(targetWords) => onChange({ ...value, targetWords })}
      />
    </>
  );
}

interface ChipOption<T> {
  value: T;
  label: string;
}

/**
 * A radio group drawn as tags: Tab reaches the chosen one (or the first), the
 * arrows move and choose, Space/Enter or a click chooses.
 */
function ChipChoice<T>({
  labelledBy,
  options,
  value,
  onChange,
  clearable = false,
}: {
  labelledBy: string;
  options: ChipOption<T | undefined>[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  clearable?: boolean;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const chosen = options.findIndex((option) => option.value === value);
  const tabStop = chosen === -1 ? 0 : chosen;

  const pick = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(clearable && option.value === value ? undefined : option.value);
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="mt-1.5 flex flex-wrap gap-1.5"
      onKeyDown={(event) => {
        const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const current = options.findIndex((_, i) => groupRef.current?.children[i] === document.activeElement);
        const next = ((current === -1 ? tabStop : current) + step + options.length) % options.length;
        onChange(options[next]!.value);
        (groupRef.current?.children[next] as HTMLElement | undefined)?.focus();
      }}
    >
      {options.map((option, i) => (
        <button
          key={option.label}
          type="button"
          role="radio"
          aria-checked={i === chosen}
          tabIndex={i === tabStop ? 0 : -1}
          className="choice-chip"
          onClick={() => pick(i)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
