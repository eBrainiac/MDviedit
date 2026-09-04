/**
 * Lado "Sin formato" de cada FormatCommand (ADR-004 IN-013): operan sobre
 * el EditorView de CodeMirror activo. IN-010 (inline: negrita/cursiva/
 * tachado/código/enlace/imagen): envuelve la selección; sin selección,
 * inserta marcadores con el cursor en medio; si ya está envuelta, la quita
 * (toggle). IN-011 (línea: encabezado/lista/lista numerada/tarea/cita):
 * aplica a todas las líneas de la selección; si todas ya lo tienen, lo
 * quita.
 */
import type { EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";

function nodeAt(view: EditorView, pos: number): SyntaxNode {
  return syntaxTree(view.state).resolveInner(pos, -1);
}

function hasAncestor(node: SyntaxNode, names: readonly string[]): boolean {
  let current: SyntaxNode | null = node;
  while (current) {
    if (names.includes(current.type.name)) return true;
    current = current.parent;
  }
  return false;
}

/** IN-010: envolver/quitar un marcador simétrico (p. ej. `**sel**`). */
export function toggleInlineMark(markNames: readonly string[], marker: string) {
  return {
    isActive(view: EditorView): boolean {
      const { from, to } = view.state.selection.main;
      return hasAncestor(nodeAt(view, from), markNames) && hasAncestor(nodeAt(view, to), markNames);
    },
    run(view: EditorView): void {
      const { from, to } = view.state.selection.main;
      const text = view.state.sliceDoc(from, to);
      const before = view.state.sliceDoc(Math.max(0, from - marker.length), from);
      const after = view.state.sliceDoc(to, to + marker.length);

      if (before === marker && after === marker) {
        // Ya envuelto justo alrededor de la selección: quitarlo.
        view.dispatch({
          changes: [
            { from: from - marker.length, to: from, insert: "" },
            { from: to, to: to + marker.length, insert: "" },
          ],
          selection: { anchor: from - marker.length, head: to - marker.length },
        });
        return;
      }

      const insert = `${marker}${text}${marker}`;
      view.dispatch({
        changes: { from, to, insert },
        selection:
          text.length > 0
            ? { anchor: from + insert.length }
            : { anchor: from + marker.length, head: from + marker.length },
      });
      view.focus();
    },
  };
}

const LINE_PREFIX_HEADING = ["ATXHeading1", "ATXHeading2", "ATXHeading3", "ATXHeading4", "ATXHeading5", "ATXHeading6"];

function selectedLineRange(view: EditorView): { from: number; to: number } {
  const { from, to } = view.state.selection.main;
  const startLine = view.state.doc.lineAt(from);
  const endLine = view.state.doc.lineAt(to);
  return { from: startLine.from, to: endLine.to };
}

function eachSelectedLine(view: EditorView): { number: number; from: number; to: number; text: string }[] {
  const { from, to } = selectedLineRange(view);
  const lines: { number: number; from: number; to: number; text: string }[] = [];
  let pos = from;
  while (pos <= to) {
    const line = view.state.doc.lineAt(pos);
    lines.push({ number: line.number, from: line.from, to: line.to, text: line.text });
    pos = line.to + 1;
  }
  return lines;
}

/** IN-011: prefijo de línea simple (cita `> `, lista `- `). */
export function toggleLinePrefix(prefix: string, activeNames: readonly string[]) {
  return {
    isActive(view: EditorView): boolean {
      const { from } = view.state.selection.main;
      return hasAncestor(nodeAt(view, from), activeNames);
    },
    run(view: EditorView): void {
      const lines = eachSelectedLine(view);
      const allPrefixed = lines.every((line) => line.text.startsWith(prefix));
      const changes = lines.map((line) =>
        allPrefixed
          ? { from: line.from, to: line.from + prefix.length, insert: "" }
          : { from: line.from, to: line.from, insert: prefix },
      );
      view.dispatch({ changes });
      view.focus();
    },
  };
}

/** IN-011: encabezado ATX (Mod+Alt+1/2/3, quitar con Mod+Alt+0 — PD-19). */
export function headingCommand(level: number) {
  const marker = `${"#".repeat(level)} `;
  return {
    isActive(view: EditorView): boolean {
      const { from } = view.state.selection.main;
      return hasAncestor(nodeAt(view, from), [`ATXHeading${level}`]);
    },
    run(view: EditorView): void {
      const line = view.state.doc.lineAt(view.state.selection.main.from);
      const stripped = line.text.replace(/^#{1,6}\s+/, "");
      const isSameLevel = new RegExp(`^#{${level}}\\s`).test(line.text);
      const insert = isSameLevel ? stripped : `${marker}${stripped}`;
      view.dispatch({ changes: { from: line.from, to: line.to, insert } });
      view.focus();
    },
  };
}

export function headingClearCommand() {
  return {
    isActive(view: EditorView): boolean {
      const { from } = view.state.selection.main;
      return !hasAncestor(nodeAt(view, from), LINE_PREFIX_HEADING);
    },
    run(view: EditorView): void {
      const line = view.state.doc.lineAt(view.state.selection.main.from);
      const stripped = line.text.replace(/^#{1,6}\s+/, "");
      view.dispatch({ changes: { from: line.from, to: line.to, insert: stripped } });
      view.focus();
    },
  };
}

/** IN-011: lista con viñetas u ordenada. */
export function toggleListCommand(ordered: boolean) {
  const nodeNames = ordered ? ["OrderedList"] : ["BulletList"];
  return {
    isActive(view: EditorView): boolean {
      const { from } = view.state.selection.main;
      return hasAncestor(nodeAt(view, from), nodeNames);
    },
    run(view: EditorView): void {
      const lines = eachSelectedLine(view);
      const bulletRe = /^[-*+]\s/;
      const orderedRe = /^\d+\.\s/;
      const matchRe = ordered ? orderedRe : bulletRe;
      const allMarked = lines.every((line) => matchRe.test(line.text));
      const changes = lines.map((line, index) => {
        const withoutMarker = line.text.replace(ordered ? orderedRe : bulletRe, "");
        if (allMarked) return { from: line.from, to: line.to, insert: withoutMarker };
        const marker = ordered ? `${index + 1}. ` : "- ";
        const bare = line.text.replace(bulletRe, "").replace(orderedRe, "");
        return { from: line.from, to: line.to, insert: `${marker}${bare}` };
      });
      view.dispatch({ changes });
      view.focus();
    },
  };
}

/** IN-011: tarea GFM `- [ ] ` / `- [x] `. */
export function toggleTaskCommand() {
  const taskRe = /^([-*+]) \[([ xX])\] /;
  return {
    isActive(view: EditorView): boolean {
      const line = view.state.doc.lineAt(view.state.selection.main.from);
      return taskRe.test(line.text);
    },
    run(view: EditorView): void {
      const lines = eachSelectedLine(view);
      const allTasks = lines.every((line) => taskRe.test(line.text));
      const changes = lines.map((line) => {
        if (allTasks) return { from: line.from, to: line.to, insert: line.text.replace(taskRe, "") };
        const bulletMatch = /^[-*+]\s+/.exec(line.text);
        const rest = bulletMatch ? line.text.slice(bulletMatch[0].length) : line.text;
        return { from: line.from, to: line.to, insert: `- [ ] ${rest}` };
      });
      view.dispatch({ changes });
      view.focus();
    },
  };
}

/** IN-010: enlace `[sel](url)`, cursor en `url`. */
export function linkCommand() {
  return {
    isActive(view: EditorView): boolean {
      const { from } = view.state.selection.main;
      return hasAncestor(nodeAt(view, from), ["Link"]);
    },
    run(view: EditorView): void {
      const { from, to } = view.state.selection.main;
      const text = view.state.sliceDoc(from, to) || "enlace";
      const placeholder = "url";
      const prefix = `[${text}](`;
      const insert = `${prefix}${placeholder})`;
      const urlStart = from + prefix.length;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: urlStart, head: urlStart + placeholder.length },
      });
      view.focus();
    },
  };
}

/** IN-010: imagen `![sel](ruta)`. */
export function imageCommand() {
  return {
    isActive(): boolean {
      return false;
    },
    run(view: EditorView): void {
      const { from, to } = view.state.selection.main;
      const text = view.state.sliceDoc(from, to) || "descripción";
      const placeholder = "ruta";
      const prefix = `![${text}](`;
      const insert = `${prefix}${placeholder})`;
      const pathStart = from + prefix.length;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: pathStart, head: pathStart + placeholder.length },
      });
      view.focus();
    },
  };
}

/** IN-010: bloque de código ``` envolviendo líneas. */
export function codeBlockCommand() {
  return {
    isActive(view: EditorView): boolean {
      const { from } = view.state.selection.main;
      return hasAncestor(nodeAt(view, from), ["FencedCode", "CodeBlock"]);
    },
    run(view: EditorView): void {
      const { from, to } = selectedLineRange(view);
      const text = view.state.sliceDoc(from, to);
      const insert = `\`\`\`\n${text}\n\`\`\``;
      view.dispatch({ changes: { from, to, insert } });
      view.focus();
    },
  };
}

/** Tabla 2×2 con encabezado. */
export function tableCommand() {
  const table = "| Encabezado 1 | Encabezado 2 |\n| --- | --- |\n| Celda | Celda |";
  return {
    isActive(): boolean {
      return false;
    },
    run(view: EditorView): void {
      const { from } = view.state.selection.main;
      view.dispatch({ changes: { from, to: from, insert: table } });
      view.focus();
    },
  };
}

/** Línea horizontal `---` en línea propia. */
export function hrCommand() {
  return {
    isActive(): boolean {
      return false;
    },
    run(view: EditorView): void {
      const line = view.state.doc.lineAt(view.state.selection.main.from);
      const insert = `${line.text.length > 0 ? "\n" : ""}---\n`;
      view.dispatch({ changes: { from: line.to, to: line.to, insert } });
      view.focus();
    },
  };
}
