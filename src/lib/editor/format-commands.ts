/**
 * BL-033: los 14 botones de FormatToolbar, en el orden de
 * UI-TOUCH-CONTROLS.md §2. Cada uno implementa `FormatCommand` (ADR-004
 * IN-013): un comando para Sin formato (CodeMirror) y uno para Formato
 * (Milkdown), con un solo `isActive`/`run` despachando según qué editor
 * esté montado (MEM-001: solo uno a la vez). El botón #5 "Encabezado" es
 * un desplegable (H1/H2/H3/quitar, PD-19) — `headingLevels` trae sus 4
 * subcomandos; `isActive` del comando "heading" se enciende si cualquiera
 * de los 3 niveles lo está.
 */
import type { ActiveEditor } from "../stores/active-editor.svelte";
import type { Editor as MilkdownEditor } from "@milkdown/core";
import { appConfig } from "../../config/app.config";
import * as raw from "./raw-format-commands";
import * as wysiwyg from "./wysiwyg-format-commands";

export interface FormatCommand {
  readonly id: string;
  readonly icon: string;
  readonly labelKey: string;
  readonly shortcut?: string;
  readonly separatorAfter?: boolean;
  isActive(editor: ActiveEditor): boolean;
  run(editor: ActiveEditor): void;
}

interface RawSide {
  isActive(view: import("@codemirror/view").EditorView): boolean;
  run(view: import("@codemirror/view").EditorView): void;
}

interface WysiwygSide {
  isActive(editor: MilkdownEditor): boolean;
  run(editor: MilkdownEditor): void;
}

function define(
  id: string,
  icon: string,
  labelKey: string,
  rawCmd: RawSide,
  wysiwygCmd: WysiwygSide,
  shortcut?: string,
  separatorAfter?: boolean,
): FormatCommand {
  return {
    id,
    icon,
    labelKey,
    shortcut,
    separatorAfter,
    isActive(editor) {
      if (!editor) return false;
      return editor.kind === "raw" ? rawCmd.isActive(editor.view) : wysiwygCmd.isActive(editor.editor);
    },
    run(editor) {
      if (!editor) return;
      if (editor.kind === "raw") rawCmd.run(editor.view);
      else wysiwygCmd.run(editor.editor);
    },
  };
}

const s = appConfig.shortcuts;

const HEADING_LEVEL_1 = 1;
const HEADING_LEVEL_2 = 2;
const HEADING_LEVEL_3 = 3;

/** Subcomandos del desplegable "Encabezado" (H1/H2/H3/Quitar). */
export const headingLevels: readonly FormatCommand[] = [
  define(
    "heading1",
    "heading-1",
    "toolbar.heading1",
    raw.headingCommand(HEADING_LEVEL_1),
    wysiwyg.wysiwygHeading(HEADING_LEVEL_1),
    s.heading1,
  ),
  define(
    "heading2",
    "heading-2",
    "toolbar.heading2",
    raw.headingCommand(HEADING_LEVEL_2),
    wysiwyg.wysiwygHeading(HEADING_LEVEL_2),
    s.heading2,
  ),
  define(
    "heading3",
    "heading-3",
    "toolbar.heading3",
    raw.headingCommand(HEADING_LEVEL_3),
    wysiwyg.wysiwygHeading(HEADING_LEVEL_3),
    s.heading3,
  ),
];

export const headingClearCommand: FormatCommand = define(
  "headingClear",
  "heading-1",
  "toolbar.headingClear",
  raw.headingClearCommand(),
  wysiwyg.wysiwygHeadingClear,
  s.headingClear,
);

/** Botón #5: icono fijo, activo si el cursor está en cualquier H1/H2/H3. */
const headingGroupCommand: FormatCommand = {
  id: "heading",
  icon: "heading-1",
  labelKey: "toolbar.heading",
  separatorAfter: true,
  isActive: (editor) => headingLevels.some((cmd) => cmd.isActive(editor)),
  run: () => {
    /* no-op: el clic abre el desplegable (FormatToolbar), no aplica un nivel por defecto */
  },
};

/** Los 14 botones de UI-TOUCH-CONTROLS §2, en orden. */
export const formatCommands: readonly FormatCommand[] = [
  define("bold", "bold", "toolbar.bold", raw.toggleInlineMark(["StrongEmphasis"], "**"), wysiwyg.wysiwygBold, s.bold),
  define("italic", "italic", "toolbar.italic", raw.toggleInlineMark(["Emphasis"], "*"), wysiwyg.wysiwygItalic, s.italic),
  define(
    "strikethrough",
    "strikethrough",
    "toolbar.strikethrough",
    raw.toggleInlineMark(["Strikethrough"], "~~"),
    wysiwyg.wysiwygStrikethrough,
    s.strikethrough,
  ),
  define(
    "inlineCode",
    "code",
    "toolbar.inlineCode",
    raw.toggleInlineMark(["InlineCode"], "`"),
    wysiwyg.wysiwygInlineCode,
    s.inlineCode,
    true,
  ),
  headingGroupCommand,
  define("list", "list", "toolbar.list", raw.toggleListCommand(false), wysiwyg.wysiwygList, s.list),
  define(
    "listOrdered",
    "list-ordered",
    "toolbar.listOrdered",
    raw.toggleListCommand(true),
    wysiwyg.wysiwygListOrdered,
    s.listOrdered,
  ),
  define("task", "list-checks", "toolbar.task", raw.toggleTaskCommand(), wysiwyg.wysiwygTask, s.task),
  define(
    "quote",
    "quote",
    "toolbar.quote",
    raw.toggleLinePrefix("> ", ["Blockquote"]),
    wysiwyg.wysiwygQuote,
    s.quote,
    true,
  ),
  define("link", "link", "toolbar.link", raw.linkCommand(), wysiwyg.wysiwygLink, s.link),
  define("image", "image", "toolbar.image", raw.imageCommand(), wysiwyg.wysiwygImage, s.image),
  define("codeBlock", "square-code", "toolbar.codeBlock", raw.codeBlockCommand(), wysiwyg.wysiwygCodeBlock, s.codeBlock),
  define("table", "table", "toolbar.table", raw.tableCommand(), wysiwyg.wysiwygTable),
  define("hr", "minus", "toolbar.hr", raw.hrCommand(), wysiwyg.wysiwygHr),
];
