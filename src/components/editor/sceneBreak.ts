import { InputRule, Node } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";

export interface SceneBreakOptions {
  /** Shown centered in place of the break, e.g. "✱ ✱ ✱" (lib/languages typography). */
  symbol: string;
}

/**
 * A break between scenes inside one chapter. Typing *** in an otherwise empty
 * paragraph turns it into a break and moves on to a fresh paragraph.
 */
export const SceneBreak = Node.create<SceneBreakOptions>({
  name: "sceneBreak",
  group: "block",
  atom: true,
  selectable: true,

  addOptions() {
    return { symbol: "* * *" };
  },

  parseHTML() {
    return [{ tag: "div[data-scene-break]" }];
  },

  renderHTML() {
    return ["div", { "data-scene-break": "", "data-symbol": this.options.symbol, class: "scene-break" }];
  },

  // Not prose: adds no words and no text to AI context.
  renderText() {
    return "";
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^\*\*\*$/u,
        handler: ({ state, range }) => {
          const $start = state.doc.resolve(range.from);
          // Only a paragraph holding nothing but the asterisks.
          if ($start.parent.type.name !== "paragraph" || range.to !== $start.end()) return null;
          const from = $start.before();
          const { tr } = state;
          tr.replaceWith(from, $start.after(), [this.type.create(), state.schema.nodes.paragraph!.create()]);
          tr.setSelection(TextSelection.create(tr.doc, from + 2));
        },
      }),
    ];
  },
});
