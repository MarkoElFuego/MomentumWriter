"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ToolbarMenuProps {
  /** aria-label of the button. */
  label: string;
  /** Tooltip: name and shortcut. */
  title: string;
  /** What the button shows (current style, icon…). */
  button: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  align?: "left" | "right";
  children: ReactNode;
}

const ITEMS = '[role^="menuitem"]:not([disabled])';

/**
 * A small menu in the toolbar. ↑/↓ moves between items, Esc closes and goes
 * back to the button, a click outside or Tab away closes it.
 */
export function ToolbarMenu({
  label,
  title,
  button,
  open,
  onOpenChange,
  disabled = false,
  align = "left",
  children,
}: ToolbarMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  // Latest callback without re-running the open effect (which moves focus).
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  useEffect(() => {
    if (!open) return;
    // Start on the chosen item, so Enter keeps it and arrows move from it.
    const items = popupRef.current?.querySelectorAll<HTMLElement>(ITEMS);
    const checked = popupRef.current?.querySelector<HTMLElement>(
      '[aria-checked="true"]:not([disabled])',
    );
    (checked ?? items?.[0])?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChangeRef.current(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const move = (step: number) => {
    const items = Array.from(popupRef.current?.querySelectorAll<HTMLElement>(ITEMS) ?? []);
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    items[(index + step + items.length) % items.length]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(event) => {
        if (!open) return;
        if (event.key === "Escape") {
          event.stopPropagation();
          onOpenChange(false);
          buttonRef.current?.focus();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          move(event.key === "ArrowDown" ? 1 : -1);
        }
      }}
      onBlur={(event) => {
        if (open && !rootRef.current?.contains(event.relatedTarget as Node | null)) onOpenChange(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        title={title}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        className="ui-button toolbar-button"
        onClick={() => onOpenChange(!open)}
      >
        {button}
      </button>
      {open && (
        <div
          ref={popupRef}
          role="menu"
          aria-label={label}
          className={`absolute top-full z-20 mt-2 min-w-44 rounded-md border border-muted/30 bg-paper p-1 text-sm shadow-sm ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
