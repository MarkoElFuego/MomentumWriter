import type { JSONContent } from "@tiptap/react";
import type { Transaction } from "dexie";
import { countWords } from "@/lib/text/countWords";
import { EMPTY_DOC } from "./doc";
import type { ID, Part, ResumeState } from "./schema";

// Shapes of the v1/v2 tables, kept only for the v3 upgrade.
export interface LegacyChapter {
  id: ID;
  bookId: ID;
  title: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface LegacyScene {
  id: ID;
  chapterId: ID;
  bookId: ID;
  title: string;
  order: number;
  content: JSONContent;
  wordCount: number;
  createdAt: number;
  updatedAt: number;
}

// Auto-generated names carry no information once chapters number themselves.
const AUTO_SCENE_TITLE = /^Scena \d+$/u;
const AUTO_CHAPTER_TITLE = /^Poglavlje [IVXLCDM]+$/u;

/**
 * One chapter's scenes (in order) as one document: a scene break between them,
 * and each scene's own title kept as an italic line where the scene began.
 * Empty scenes are dropped — they were only placeholders.
 */
export function mergeScenes(scenes: LegacyScene[]): { content: JSONContent; wordCount: number } {
  const blocks: JSONContent[] = [];
  let wordCount = 0;
  for (const scene of scenes) {
    if (scene.wordCount === 0) continue;
    if (blocks.length > 0) blocks.push({ type: "sceneBreak" });
    const title = scene.title.trim();
    if (title && !AUTO_SCENE_TITLE.test(title)) {
      blocks.push({ type: "paragraph", content: [{ type: "text", text: title, marks: [{ type: "italic" }] }] });
      wordCount += countWords(title);
    }
    blocks.push(...(scene.content.content ?? []));
    wordCount += scene.wordCount;
  }
  return { content: blocks.length > 0 ? { type: "doc", content: blocks } : EMPTY_DOC, wordCount };
}

export async function upgradeToParts(tx: Transaction): Promise<void> {
  const chapters: LegacyChapter[] = await tx.table("chapters").toArray();
  const scenes: LegacyScene[] = await tx.table("scenes").toArray();

  const parts: Part[] = chapters.map((chapter) => {
    const own = scenes.filter((s) => s.chapterId === chapter.id).sort((a, b) => a.order - b.order);
    const { content, wordCount } = mergeScenes(own);
    const title = chapter.title.trim();
    return {
      id: chapter.id,
      bookId: chapter.bookId,
      kind: "chapter",
      title: AUTO_CHAPTER_TITLE.test(title) ? "" : title,
      order: chapter.order,
      content,
      wordCount,
      createdAt: chapter.createdAt,
      updatedAt: Math.max(chapter.updatedAt, ...own.map((s) => s.updatedAt)),
    };
  });
  await tx.table("parts").bulkAdd(parts);

  // Scene ids become the id of the chapter they were merged into. The old
  // cursor position points into a scene that no longer exists, so start over.
  const chapterOf = new Map(scenes.map((s) => [s.id, s.chapterId]));
  await tx
    .table("resumeState")
    .toCollection()
    .modify((state: ResumeState & { sceneId?: ID }) => {
      state.partId = chapterOf.get(state.sceneId ?? "") ?? state.partId;
      delete state.sceneId;
      state.cursorPos = 0;
    });
}
