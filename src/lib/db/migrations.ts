import type { JSONContent } from "@tiptap/react";
import type { Transaction } from "dexie";
import { copy } from "@/lib/copy";
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

function blockText(node: JSONContent): string {
  if (typeof node.text === "string") return node.text;
  return (node.content ?? []).map(blockText).join("");
}

const normalize = (text: string) => text.trim().replace(/\s+/gu, " ").toLocaleLowerCase("sr");

/**
 * A chapter title typed as a Naslov 1 at the top of the text — now that the
 * title has its own field, the copy in the text goes. Only when it says
 * exactly what the table of contents says (also "Poglavlje II · Kofer" or
 * "II · Kofer"); anything else is the author's text and stays.
 */
export function stripTitleHeading(
  part: Pick<Part, "kind" | "title" | "content" | "wordCount">,
  chapterNumber: number | undefined,
): { content: JSONContent; wordCount: number } | null {
  const [first, ...rest] = part.content.content ?? [];
  if (first?.type !== "heading" || (first.attrs?.level ?? 1) !== 1) return null;

  const names = [part.title];
  if (part.kind === "chapter" && chapterNumber) {
    names.push(
      copy.structure.chapterHeading(chapterNumber, part.title),
      copy.structure.chapterLabel(chapterNumber, part.title),
    );
  }
  const text = blockText(first);
  if (!normalize(text) || !names.some((name) => normalize(name) === normalize(text))) return null;

  return {
    content: { ...part.content, content: rest.length > 0 ? rest : EMPTY_DOC.content },
    wordCount: Math.max(0, part.wordCount - countWords(text)),
  };
}

export async function upgradeTitleHeadings(tx: Transaction): Promise<void> {
  const parts: Part[] = await tx.table("parts").toArray();
  // Chapter numbers per book, the same way the table of contents counts them.
  const numbers = new Map<ID, number>();
  const byBook = new Map<ID, Part[]>();
  for (const part of parts) {
    if (part.kind === "chapter") byBook.set(part.bookId, [...(byBook.get(part.bookId) ?? []), part]);
  }
  for (const chapters of byBook.values()) {
    chapters.sort((a, b) => a.order - b.order).forEach((part, i) => numbers.set(part.id, i + 1));
  }

  for (const part of parts) {
    const stripped = stripTitleHeading(part, numbers.get(part.id));
    if (stripped) await tx.table("parts").update(part.id, stripped);
  }
}
