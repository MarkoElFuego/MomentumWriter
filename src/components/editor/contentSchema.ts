import { getSchema, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { getLanguage, type Language } from "@/lib/languages";
import { Footnotes, mainTextEnd } from "./footnotes";
import { LaterNote } from "./laterNote";
import { SceneBreak } from "./sceneBreak";

export const TEXT_ALIGNMENTS = ["left", "center", "justify"] as const;
export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];

/**
 * The extensions that define what a part's document may contain. The editor
 * adds its behavior on top; screens without an editor (Resume) read saved
 * content with the same schema, so positions mean the same thing.
 */
export function contentExtensions(language: Language) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2] },
      // Replaced by Footnotes, which allows a note zone at the end.
      document: false,
      // Prose only: no code, lists-as-UI or links in v0.1.
      code: false,
      codeBlock: false,
      horizontalRule: false,
      link: false,
    }),
    // "left" is the default and is not stored, so old content reads unchanged.
    TextAlign.configure({
      types: ["paragraph", "heading"],
      alignments: [...TEXT_ALIGNMENTS],
      defaultAlignment: "left",
    }),
    Footnotes,
    SceneBreak.configure({ symbol: getLanguage(language).typography.sceneBreak }),
    // Beleška za kasnije (T3) — a mark in the text, so every reader of saved content must know it.
    LaterNote,
  ] as const;
}

export function docFromJSON(content: JSONContent, language: Language): PMNode {
  return PMNode.fromJSON(getSchema([...contentExtensions(language)]), content);
}

/**
 * A saved cursor position made safe for the current text: never inside the
 * footnote zone, always inside a text block. 0 or less means "unknown" → the
 * end of the main text.
 */
export function restorablePos(doc: PMNode, pos: number): number {
  const end = mainTextEnd(doc);
  const target = pos <= 0 ? end : Math.min(pos, end);
  return TextSelection.near(doc.resolve(target), -1).from;
}
