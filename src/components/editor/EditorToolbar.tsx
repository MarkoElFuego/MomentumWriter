"use client";

import { forwardRef, useCallback, useEffect, useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import type { AppearanceControls } from "@/hooks/useAppearance";
import type { SaveStatus } from "@/hooks/useAutosave";
import { copy } from "@/lib/copy";
import { THEME_PAPER, THEMES } from "@/lib/themes";
import { BLOCK_STYLES, blockStyleAt, setBlockStyle, type BlockStyle } from "./blockStyle";
import { TEXT_ALIGNMENTS, type TextAlignment } from "./contentSchema";
import { EditorMenu, type EditorMenuProps } from "./EditorMenu";
import { ToolbarMenu } from "./ToolbarMenu";

type MenuName = "style" | "align" | "theme" | "more";

interface EditorToolbarProps {
  editor: Editor | null;
  saveStatus: SaveStatus;
  structureOpen: boolean;
  onToggleStructure: () => void;
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

function useFullscreen() {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  useEffect(() => {
    setSupported(document.fullscreenEnabled);
    const onChange = () => setActive(document.fullscreenElement !== null);
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggle = useCallback(() => {
    const request = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    request.catch((error) => console.error("Fullscreen failed", error));
  }, []);
  return { supported, active, toggle };
}

export const EditorToolbar = forwardRef<HTMLDivElement, EditorToolbarProps>(function EditorToolbar(
  { editor, saveStatus, structureOpen, onToggleStructure, appearance, settings, faded, onMenuOpenChange },
  ref,
) {
  const [openMenu, setOpenMenu] = useState<MenuName | null>(null);
  const fullscreen = useFullscreen();

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
      className={`toolbar grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3 text-sm text-muted${faded ? " is-faded" : ""}`}
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
          {...menuProps("style")}
        >
          {BLOCK_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              role="menuitemradio"
              aria-checked={state?.style === style}
              className="ui-button flex w-full justify-between gap-6 px-3 py-2 text-left"
              onClick={() => chooseStyle(style)}
            >
              <span>{t.blockStyles[style].name}</span>
              <span className="opacity-70">{t.blockStyles[style].shortcut}</span>
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
              className="ui-button flex w-full items-center gap-3 px-3 py-2 text-left"
              onClick={() => chooseAlign(align)}
            >
              <AlignIcon align={align} />
              <span>{t.alignments[align]}</span>
            </button>
          ))}
        </ToolbarMenu>
      </div>

      <p role="status" aria-live="polite" className="toolbar-status text-center">
        {copy.save[saveStatus]}
      </p>

      <div className="flex items-center justify-end gap-1">
        <ToolbarMenu label={t.themes} title={t.themes} align="right" button={<span aria-hidden="true">◐</span>} {...menuProps("theme")}>
          <div className="flex gap-2 px-2 py-1">
            {THEMES.map((theme) => (
              <button
                key={theme}
                type="button"
                role="menuitemradio"
                title={t.themeNames[theme]}
                aria-label={t.themeNames[theme]}
                aria-checked={appearance.theme === theme}
                className="theme-swatch"
                style={{ backgroundColor: THEME_PAPER[theme] }}
                onClick={() => appearance.onTheme(theme)}
              />
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
        <EditorMenu {...settings} {...menuProps("more")} />
      </div>
    </div>
  );
});
