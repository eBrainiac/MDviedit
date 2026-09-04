/**
 * Tema de CodeMirror por tokens (BL-021, RULE-001): ningún color/tamaño
 * literal — todo son referencias a las CSS custom properties de
 * src/config/tokens.css y src/config/palettes/*.css, así que el editor
 * sigue paleta y modo automáticamente sin reconfigurarse.
 */
import { HighlightStyle } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

export const markdownHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontWeight: "700", fontSize: "calc(var(--fs-editor) * var(--content-h1-scale))" },
  { tag: t.heading2, fontWeight: "700", fontSize: "calc(var(--fs-editor) * var(--content-h2-scale))" },
  { tag: t.heading3, fontWeight: "700", fontSize: "calc(var(--fs-editor) * var(--content-h3-scale))" },
  { tag: t.heading4, fontWeight: "700", fontSize: "calc(var(--fs-editor) * var(--content-h4-scale))" },
  { tag: [t.heading5, t.heading6], fontWeight: "700" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "var(--c-accent)", textDecoration: "underline" },
  { tag: t.url, color: "var(--c-accent)" },
  { tag: t.monospace, fontFamily: "var(--font-mono)", backgroundColor: "var(--c-code-bg)" },
  { tag: t.quote, color: "var(--c-text-muted)", fontStyle: "italic" },
  { tag: t.processingInstruction, color: "var(--c-text-muted)" },
  { tag: t.contentSeparator, color: "var(--c-border)" },
  { tag: t.meta, color: "var(--c-text-muted)" },
  { tag: t.comment, color: "var(--c-text-muted)" },
]);

export function createEditorTheme(): Extension {
  return EditorView.theme({
    "&": {
      height: "100%",
      color: "var(--c-text)",
      backgroundColor: "var(--c-bg)",
      fontSize: "var(--fs-editor)",
    },
    ".cm-content": {
      fontFamily: "var(--font-mono)",
      caretColor: "var(--c-accent)",
      padding: "var(--space-4)",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-mono)",
      lineHeight: "var(--lh-content)",
    },
    "&.cm-focused .cm-cursor": {
      borderLeftColor: "var(--c-accent)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "var(--c-selection)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--c-bg)",
      color: "var(--c-text-muted)",
      border: "none",
    },
    ".cm-activeLine, .cm-activeLineGutter": {
      backgroundColor: "var(--c-bg-hover)",
    },
    "&.cm-focused": {
      outline: "none",
    },
  });
}
