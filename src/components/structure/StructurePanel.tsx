"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { copy } from "@/lib/copy";
import { getBook, renameBook } from "@/lib/db/books";
import { createChapter, listChapters, renameChapter } from "@/lib/db/chapters";
import type { Book, Chapter, ID, Scene } from "@/lib/db/schema";
import { createScene, listScenesByBook, renameScene } from "@/lib/db/scenes";
import { InlineEdit } from "./InlineEdit";

interface StructurePanelProps {
  bookId: ID;
  currentSceneId: ID;
  onNavigate: (sceneId: ID) => void;
  onClose: () => void;
  /** Titles changed — the editor header may need to refresh. */
  onChanged: () => void;
  /** Move focus into the panel (when the user opened it, not when restored). */
  autoFocus: boolean;
}

type Editing = { kind: "book" | "chapter" | "scene"; id: ID } | null;

export function StructurePanel({
  bookId,
  currentSceneId,
  onNavigate,
  onClose,
  onChanged,
  autoFocus,
}: StructurePanelProps) {
  const [book, setBook] = useState<Book>();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const currentRef = useRef<HTMLButtonElement>(null);
  const focusedOnOpen = useRef(false);

  const reload = useCallback(async () => {
    const [b, c, s] = await Promise.all([
      getBook(bookId),
      listChapters(bookId),
      listScenesByBook(bookId),
    ]);
    setBook(b);
    setChapters(c);
    setScenes(s);
  }, [bookId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Keyboard users land on the current scene when the panel opens.
  useEffect(() => {
    if (autoFocus && !focusedOnOpen.current && currentRef.current) {
      currentRef.current.focus();
      focusedOnOpen.current = true;
    }
  }, [scenes, autoFocus]);

  const rename = async (fn: (id: ID, title: string) => Promise<void>, id: ID, title: string) => {
    setEditing(null);
    await fn(id, title);
    await reload();
    onChanged();
  };

  const isEditing = (kind: NonNullable<Editing>["kind"], id: ID) =>
    editing?.kind === kind && editing.id === id;

  const renameKeys = (kind: NonNullable<Editing>["kind"], id: ID) => ({
    onDoubleClick: () => setEditing({ kind, id }),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "F2") {
        event.preventDefault();
        setEditing({ kind, id });
      }
    },
    title: copy.structure.renameHint,
  });

  return (
    <nav
      aria-label={copy.structure.panelLabel}
      className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-muted/20 px-3 py-4 text-sm"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        {book && isEditing("book", book.id) ? (
          <InlineEdit
            value={book.title}
            onSave={(title) => void rename(renameBook, book.id, title)}
            onCancel={() => setEditing(null)}
            className="font-serif"
          />
        ) : (
          <button
            type="button"
            className="ui-button truncate px-1 text-left font-serif text-ink"
            {...(book ? renameKeys("book", book.id) : {})}
          >
            {book?.title}
          </button>
        )}
        <button
          type="button"
          aria-label={copy.structure.close}
          className="ui-button px-1"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <ol className="space-y-4">
        {chapters.map((chapter) => (
          <li key={chapter.id}>
            {isEditing("chapter", chapter.id) ? (
              <InlineEdit
                value={chapter.title}
                onSave={(title) => void rename(renameChapter, chapter.id, title)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <button
                type="button"
                className="ui-button w-full truncate px-1 text-left text-xs uppercase tracking-wider"
                {...renameKeys("chapter", chapter.id)}
              >
                {chapter.title}
              </button>
            )}

            <ol className="mt-1 space-y-0.5">
              {scenes
                .filter((scene) => scene.chapterId === chapter.id)
                .map((scene) => {
                  const isCurrent = scene.id === currentSceneId;
                  return (
                    <li key={scene.id}>
                      {isEditing("scene", scene.id) ? (
                        <InlineEdit
                          value={scene.title}
                          onSave={(title) => void rename(renameScene, scene.id, title)}
                          onCancel={() => setEditing(null)}
                        />
                      ) : (
                        <button
                          ref={isCurrent ? currentRef : undefined}
                          type="button"
                          aria-current={isCurrent ? "page" : undefined}
                          className={`ui-button w-full truncate px-3 py-1 text-left ${isCurrent ? "text-ink" : ""}`}
                          onClick={() => {
                            if (!isCurrent) onNavigate(scene.id);
                          }}
                          {...renameKeys("scene", scene.id)}
                        >
                          {scene.title}
                        </button>
                      )}
                    </li>
                  );
                })}
              <li>
                <button
                  type="button"
                  className="ui-button px-3 py-1 text-xs"
                  onClick={async () => {
                    const scene = await createScene(chapter.id);
                    await reload();
                    onNavigate(scene.id);
                  }}
                >
                  {copy.structure.addScene}
                </button>
              </li>
            </ol>
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="ui-button mt-4 self-start px-1 text-xs"
        onClick={async () => {
          const { scene } = await createChapter(bookId);
          await reload();
          onNavigate(scene.id);
        }}
      >
        {copy.structure.addChapter}
      </button>
    </nav>
  );
}
