import { getSchema, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { getLanguage, type Language } from "@/lib/languages";
import { Footnotes, mainTextEnd } from "./footnotes";
import { SceneBreak } from "./sceneBreak";

/**
 * The extensions that define what a part's document may contain. The editor
 * adds its behavior on top; screens without an editor (Resume) read saved
 * content with the same schema, so positions mean the same thing.
 */
export function contentExtensions(language: Language) {
  return [
    StarterKit.configure({
      heading: { levels: [1] },
      // Replaced by Footnotes, which allows a note zone at the end.
      document: false,
      // Prose only: no code, lists-as-UI or links in v0.1.
      code: false,
      codeBlock: false,
      horizontalRule: false,
      link: false,
    }),
    Footnotes,
    SceneBreak.configure({ symbol: getLanguage(language).typography.sceneBreak }),
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
