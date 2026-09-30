import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Marks the block holding the cursor. Only CSS under .focus-mode acts on it
// (the other blocks fade), so turning the mode on and off needs no editor change.
export const FocusMode = Extension.create({
  name: "focusMode",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("focusMode"),
        props: {
          decorations(state) {
            const { $head } = state.selection;
            if ($head.depth < 1) return null;
            const from = $head.before(1);
            return DecorationSet.create(state.doc, [
              Decoration.node(from, from + state.doc.child($head.index(0)).nodeSize, { class: "has-focus" }),
            ]);
          },
        },
      }),
    ];
  },
});
