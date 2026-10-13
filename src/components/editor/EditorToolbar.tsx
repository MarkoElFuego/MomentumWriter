"use client";

import { forwardRef, useEffect, useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import type { AppearanceControls } from "@/hooks/useAppearance";
import type { FullscreenControls } from "@/hooks/useFullscreen";
import type { SaveStatus } from "@/hooks/useAutosave";
import { copy } from "@/lib/copy";
import { THEME_SWATCH, THEMES } from "@/lib/themes";
import { BLOCK_STYLES, blockStyleAt, setBlockStyle, type BlockStyle } from "./blockStyle";
import { TEXT_ALIGNMENTS, type TextAlignment } from "./contentSchema";
import { EditorMenu, type EditorMenuProps } from "./EditorMenu";
import { tidyTr } from "./tidyText";
import { ToolbarMenu } from "./ToolbarMenu";

type MenuName = "style" | "align" | "theme" | "more";

interface EditorToolbarProps {
  editor: Editor | null;
  saveStatus: SaveStatus;
  /** First draft: "Nacrt 1 · Sačuvano" with its tooltip (an error is shown on its own). */
  draft: boolean;
  structureOpen: boolean;
  onToggleStructure: () => void;
  tironOpen: boolean;
  onToggleTiron: () => void;
  /** A whisper came while the panel was closed (T5): a small dot by T. */
  tironDot: boolean;
  fullscreen: FullscreenControls;
  appearance: AppearanceControls;
  /** Settings left in ···. */
  settings: Omit<EditorMenuProps, "open" | "onOpenChange">;
  faded: boolean;
  onMenuOpenChange: (open: boolean) => void;
}

const { toolbar: t } = copy;

function AlignIcon({ align }: { align: TextAlignment }) {
  // Four lines; their lengths and offsets show the alignment.
  const lines: Record<TextAlignment, [number, number][]> = {
    left: [[2, 14], [2, 10], [2, 14], [2, 8]],
    center: [[2, 14], [4, 12], [2, 14], [5, 11]],
    justify: [[2, 14], [2, 14], [2, 14], [2, 9]],
  };
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {lines[align].map(([x1, x2], i) => (
        <line key={i} x1={x1} x2={x2} y1={3 + i * 3.4} y2={3 + i * 3.4} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function Toggle({
  label,
  shortcut,
  pressed,
  disabled,
  onPress,
  keepEditorFocus = false,
  children,
}: {
  label: string;
  shortcut?: string;
  pressed: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** B / I: a mouse click must not take the selection away from the text. */
  keepEditorFocus?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={shortcut ? t.withShortcut(label, shortcut) : label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      className="ui-button toolbar-button"
      onMouseDown={keepEditorFocus ? (event) => event.preventDefault() : undefined}
      onClick={onPress}
    >
      {children}
    </button>
  );
}

/** „Sredi tekst”: a broom — ¶ means "show hidden marks" in Word. */
function BroomIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 3 12.5 9.5" />
      <path d="M10.2 8.6 15.4 13.8" />
      <path d="M10.2 8.6c-2.6 1.1-4.6 3.3-5.7 6.4L3.5 18l2.3 2.3 3-1c3.1-1.1 5.3-3.1 6.4-5.7" />
      <path d="M6.6 16.4 8.3 14.7" />
    </svg>
  );
}

export const EditorToolbar = forwardRef<HTMLDivElement, EditorToolbarProps>(function EditorToolbar(
  {
    editor,
    saveStatus,
    draft,
    structureOpen,
    onToggleStructure,
    tironOpen,
    onToggleTiron,
    tironDot,
    fullscreen,
    appearance,
    settings,
    faded,
    onMenuOpenChange,
  },
  ref,
) {
  const [openMenu, setOpenMenu] = useState<MenuName | null>(null);
  const showDraft = draft && saveStatus !== "error";

  useEffect(() => onMenuOpenChange(openMenu !== null), [openMenu, onMenuOpenChange]);

  const menuProps = (name: MenuName) => ({
    open: openMenu === name,
    onOpenChange: (open: boolean) => setOpenMenu((current) => (open ? name : current === name ? null : current)),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            style: blockStyleAt(editor.state),
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            align: TEXT_ALIGNMENTS.find((align) => align !== "left" && editor.isActive({ textAlign: align })) ?? "left",
          }
        : null,
  });

  const chooseStyle = (style: BlockStyle) => {
    setOpenMenu(null);
    if (!editor) return;
    editor.commands.focus();
    setBlockStyle(style)(editor.state, editor.view.dispatch);
  };

  const chooseAlign = (align: TextAlignment) => {
    setOpenMenu(null);
    editor?.chain().focus().setTextAlign(align).run();
  };

  const styleName = t.blockStyles[state?.style ?? "paragraph"].name;
  const noBlockStyle = !state?.style;

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={t.label}
      className={`toolbar fades grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3 text-sm text-muted${faded ? " is-faded" : ""}`}
    >
      <div className="flex items-center gap-1">
        <Toggle
          label={t.structure}
          shortcut={t.structureShortcut}
          pressed={structureOpen}
          onPress={onToggleStructure}
        >
          <span aria-hidden="true">☰</span>
        </Toggle>
        <ToolbarMenu
          label={t.blockStyle}
          title={t.blockStyle}
          disabled={noBlockStyle}
          button={<span className="whitespace-nowrap">{styleName} <span aria-hidden="true">▾</span></span>}
          menuClassName="min-w-60"
          {...menuProps("style")}
        >
          {BLOCK_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              role="menuitemradio"
              aria-checked={state?.style === style}
              className="ui-button flex w-full items-baseline gap-6 whitespace-nowrap px-3 py-2 text-left"
              onClick={() => chooseStyle(style)}
            >
              <span className="flex-1">{t.blockStyles[style].name}</span>
              <span className="text-xs text-muted">
                {t.blockStyles[style].shortcut}
                {t.blockStyles[style].markdown && (
                  <span className="ml-2 font-mono opacity-60">{t.blockStyles[style].markdown}</span>
                )}
              </span>
            </button>
          ))}
        </ToolbarMenu>
        <Toggle
          label={t.bold}
          shortcut={t.boldShortcut}
          pressed={!!state?.bold}
          disabled={!editor}
          keepEditorFocus
          onPress={() => editor?.chain().focus().toggleBold().run()}
        >
          <span aria-hidden="true" className="font-bold">B</span>
        </Toggle>
        <Toggle
          label={t.italic}
          shortcut={t.italicShortcut}
          pressed={!!state?.italic}
          disabled={!editor}
          keepEditorFocus
          onPress={() => editor?.chain().focus().toggleItalic().run()}
        >
          <span aria-hidden="true" className="font-serif italic">I</span>
        </Toggle>
        <ToolbarMenu
          label={t.align}
          title={`${t.align}: ${t.alignments[state?.align ?? "left"]}`}
          disabled={noBlockStyle}
          button={
            <span className="flex items-center gap-1">
              <AlignIcon align={state?.align ?? "left"} />
              <span aria-hidden="true">▾</span>
            </span>
          }
          {...menuProps("align")}
        >
          {TEXT_ALIGNMENTS.map((align) => (
            <button
              key={align}
              type="button"
              role="menuitemradio"
              aria-checked={state?.align === align}
              className="ui-button flex w-full items-center gap-3 whitespace-nowrap px-3 py-2 text-left"
              onClick={() => chooseAlign(align)}
            >
              <AlignIcon align={align} />
              <span className="flex-1">{t.alignments[align]}</span>
              <span aria-hidden="true" className={`text-accent ${state?.align === align ? "" : "invisible"}`}>
                ✓
              </span>
            </button>
          ))}
        </ToolbarMenu>
        <button
          type="button"
          title={t.tidyHint}
          aria-label={t.tidy}
          // Like alignment: not in a footnote.
          disabled={noBlockStyle}
          className="ui-button toolbar-button"
          // The selection stays in the text — it is what gets tidied.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (!editor) return;
            const tr = tidyTr(editor.state);
            if (tr) editor.view.dispatch(tr);
            editor.commands.focus();
          }}
        >
          <BroomIcon />
        </button>
      </div>

      <p
        role="status"
        aria-live="polite"
        title={showDraft ? copy.save.draftHint : undefined}
        className="toolbar-status text-center"
      >
        {showDraft ? copy.save.draft(copy.save[saveStatus]) : copy.save[saveStatus]}
      </p>

      <div className="flex items-center justify-end gap-1">
        <ToolbarMenu label={t.themes} title={t.themes} align="right" button={<span aria-hidden="true">◐</span>} {...menuProps("theme")}>
          <div className="flex gap-2.5 px-2 py-1.5">
            {THEMES.map((theme, i) => (
              <button
                key={theme}
                type="button"
                role="menuitemradio"
                title={t.themeNames[theme]}
                aria-label={t.themeNames[theme]}
                aria-checked={appearance.theme === theme}
                className="theme-swatch"
                style={{ backgroundColor: THEME_SWATCH[theme].paper, color: THEME_SWATCH[theme].ink }}
                // Enter (a click) keeps the theme and closes; Esc closes too.
                onClick={() => {
                  appearance.onTheme(theme);
                  setOpenMenu(null);
                }}
                onKeyDown={(event) => {
                  // ←/→ pick the neighbouring theme right away, like a radio group.
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  event.preventDefault();
                  const next = THEMES[(i + (event.key === "ArrowLeft" ? -1 : 1) + THEMES.length) % THEMES.length]!;
                  appearance.onTheme(next);
                  const siblings = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(".theme-swatch");
                  siblings?.[THEMES.indexOf(next)]?.focus();
                }}
              >
                <span aria-hidden="true" className="theme-swatch-aa" style={{ fontFamily: THEME_SWATCH[theme].font }}>
                  Aa
                </span>
                <span aria-hidden="true" className="theme-swatch-name">
                  {t.themeNames[theme]}
                </span>
              </button>
            ))}
          </div>
        </ToolbarMenu>
        <Toggle label={t.typewriter} pressed={appearance.typewriter} onPress={appearance.onToggleTypewriter}>
          {/* U+FE0E: text glyph, not an emoji. */}
          <span aria-hidden="true">{"⌨︎"}</span>
        </Toggle>
        <Toggle label={t.focus} pressed={appearance.focusMode} onPress={appearance.onToggleFocus}>
          <span aria-hidden="true">◎</span>
        </Toggle>
        <Toggle
          label={t.fullscreen}
          pressed={fullscreen.active}
          disabled={!fullscreen.supported}
          onPress={fullscreen.toggle}
        >
          <span aria-hidden="true">⛶</span>
        </Toggle>
        {/* The word, quiet; the dot (in the accent) when a whisper came while the panel was closed. */}
        <Toggle
          label={tironDot ? copy.tiron.toggleNew : copy.tiron.toggle}
          shortcut={copy.tiron.shortcut}
          pressed={tironOpen}
          onPress={onToggleTiron}
        >
          <span aria-hidden="true" className="tiron-word relative">
            {copy.tiron.toolbarWord}
            {tironDot && <span className="tiron-dot" />}
          </span>
        </Toggle>
        <EditorMenu {...settings} {...menuProps("more")} />
      </div>
    </div>
  );
});
