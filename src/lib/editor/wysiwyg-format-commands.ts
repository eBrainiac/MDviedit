/**
 * Lado "Formato" de cada FormatCommand (ADR-004 IN-013): ejecuta el comando
 * equivalente de Milkdown/ProseMirror (toggleMark / setBlockType / wrapIn,
 * IN-010/011) sobre el Editor activo. `isActive` inspecciona el
 * `EditorState` de ProseMirror directamente (mismo resultado que
 * `isMarkSelectedCommand`/`isNodeSelectedCommand`, sin depender de su
 * convención exacta de invocación).
 */
import type { Editor } from "@milkdown/core";
import { editorViewCtx } from "@milkdown/core";
import { callCommand } from "@milkdown/utils";
import type { MarkType, NodeType } from "@milkdown/prose/model";
import type { EditorState } from "@milkdown/prose/state";
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  insertImageCommand,
  createCodeBlockCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInHeadingCommand,
  downgradeHeadingCommand,
  insertHrCommand,
} from "@milkdown/preset-commonmark";
import { toggleStrikethroughCommand, insertTableCommand } from "@milkdown/preset-gfm";

function state(editor: Editor): EditorState {
  return editor.ctx.get(editorViewCtx).state;
}

function markActive(editor: Editor, type: MarkType | undefined): boolean {
  if (!type) return false;
  const { from, to, empty, $from } = state(editor).selection;
  if (empty) return !!type.isInSet(state(editor).storedMarks ?? $from.marks());
  return state(editor).doc.rangeHasMark(from, to, type);
}

function nodeActive(editor: Editor, type: NodeType | undefined): boolean {
  if (!type) return false;
  const { $from } = state(editor).selection;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    if ($from.node(depth).type === type) return true;
  }
  return false;
}

function run(editor: Editor, key: Parameters<typeof callCommand>[0], payload?: unknown): void {
  editor.action(callCommand(key, payload));
  editor.ctx.get(editorViewCtx).focus();
}

export const wysiwygBold = {
  isActive: (editor: Editor) => markActive(editor, state(editor).schema.marks.strong),
  run: (editor: Editor) => run(editor, toggleStrongCommand.key),
};

export const wysiwygItalic = {
  isActive: (editor: Editor) => markActive(editor, state(editor).schema.marks.emphasis),
  run: (editor: Editor) => run(editor, toggleEmphasisCommand.key),
};

export const wysiwygStrikethrough = {
  isActive: (editor: Editor) => markActive(editor, state(editor).schema.marks.strike_through),
  run: (editor: Editor) => run(editor, toggleStrikethroughCommand.key),
};

export const wysiwygInlineCode = {
  isActive: (editor: Editor) => markActive(editor, state(editor).schema.marks.inlineCode),
  run: (editor: Editor) => run(editor, toggleInlineCodeCommand.key),
};

export function wysiwygHeading(level: number) {
  return {
    isActive: (editor: Editor) => {
      const node = state(editor).schema.nodes.heading;
      if (!node) return false;
      const { $from } = state(editor).selection;
      return $from.parent.type === node && $from.parent.attrs.level === level;
    },
    run: (editor: Editor) => run(editor, wrapInHeadingCommand.key, level),
  };
}

export const wysiwygHeadingClear = {
  isActive: (editor: Editor) => {
    const node = state(editor).schema.nodes.heading;
    if (!node) return true;
    return state(editor).selection.$from.parent.type !== node;
  },
  run: (editor: Editor) => run(editor, downgradeHeadingCommand.key),
};

export const wysiwygList = {
  isActive: (editor: Editor) => nodeActive(editor, state(editor).schema.nodes.bullet_list),
  run: (editor: Editor) => run(editor, wrapInBulletListCommand.key),
};

export const wysiwygListOrdered = {
  isActive: (editor: Editor) => nodeActive(editor, state(editor).schema.nodes.ordered_list),
  run: (editor: Editor) => run(editor, wrapInOrderedListCommand.key),
};

/** GFM no expone un comando dedicado; envuelve en lista y marca `checked`. */
export const wysiwygTask = {
  isActive: (editor: Editor) => {
    const { $from } = state(editor).selection;
    for (let depth = $from.depth; depth >= 0; depth -= 1) {
      const node = $from.node(depth);
      if (node.type === state(editor).schema.nodes.list_item && node.attrs.checked !== null) return true;
    }
    return false;
  },
  run: (editor: Editor) => {
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const listItemType = schema.nodes.list_item;
    const { $from } = view.state.selection;
    for (let depth = $from.depth; depth >= 0; depth -= 1) {
      const node = $from.node(depth);
      if (node.type === listItemType) {
        const pos = $from.before(depth);
        const checked = node.attrs.checked === null ? false : null;
        view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked }));
        view.focus();
        return;
      }
    }
    run(editor, wrapInBulletListCommand.key);
    editor.action((ctx) => {
      const v = ctx.get(editorViewCtx);
      const sel = v.state.selection.$from;
      for (let depth = sel.depth; depth >= 0; depth -= 1) {
        const node = sel.node(depth);
        if (node.type === v.state.schema.nodes.list_item) {
          const pos = sel.before(depth);
          v.dispatch(v.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: false }));
          break;
        }
      }
    });
  },
};

export const wysiwygQuote = {
  isActive: (editor: Editor) => nodeActive(editor, state(editor).schema.nodes.blockquote),
  run: (editor: Editor) => run(editor, wrapInBlockquoteCommand.key),
};

export const wysiwygLink = {
  isActive: (editor: Editor) => markActive(editor, state(editor).schema.marks.link),
  run: (editor: Editor) => run(editor, toggleLinkCommand.key, { href: "url" }),
};

export const wysiwygImage = {
  isActive: () => false,
  run: (editor: Editor) => run(editor, insertImageCommand.key, { src: "ruta", alt: "descripción" }),
};

export const wysiwygCodeBlock = {
  isActive: (editor: Editor) => nodeActive(editor, state(editor).schema.nodes.code_block),
  run: (editor: Editor) => run(editor, createCodeBlockCommand.key),
};

export const wysiwygTable = {
  isActive: (editor: Editor) => nodeActive(editor, state(editor).schema.nodes.table),
  run: (editor: Editor) => run(editor, insertTableCommand.key, { row: 2, col: 2 }),
};

export const wysiwygHr = {
  isActive: () => false,
  run: (editor: Editor) => run(editor, insertHrCommand.key),
};
