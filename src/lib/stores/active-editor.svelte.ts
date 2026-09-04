/**
 * FormatToolbar vive en TopRow, hermano de Content — no un padre/hijo del
 * editor montado. RawEditorView/WysiwygEditorView registran aquí su vista
 * viva al montar y la limpian al desmontar, para que FormatToolbar sepa
 * contra qué instancia (CodeMirror o Milkdown) ejecutar cada FormatCommand
 * (ADR-004 IN-013) sin acoplarse a los componentes de editor.
 */
import type { EditorView as CmView } from "@codemirror/view";
import type { Editor as MilkdownEditorInstance } from "@milkdown/core";

export type ActiveEditor =
  | { readonly kind: "raw"; readonly view: CmView }
  | { readonly kind: "wysiwyg"; readonly editor: MilkdownEditorInstance }
  | null;

class ActiveEditorStore {
  /**
   * `$state.raw`, no `$state`: `current` guarda una instancia viva de
   * `EditorView`/`Editor` (CodeMirror/Milkdown), no un objeto plano. Con
   * `$state` normal, Svelte intenta hacerla profundamente reactiva y eso
   * rompe la reactividad del resto de la página de forma silenciosa (ver
   * desviación en el reporte de IT-3). `$state.raw` solo reacciona a la
   * REASIGNACIÓN del campo, que es todo lo que este store necesita.
   */
  current = $state.raw<ActiveEditor>(null);
  /** Incrementado en cada update (doc o selección) para que FormatToolbar
   * vuelva a evaluar isActive() sin necesitar una nueva instancia de vista. */
  version = $state(0);

  bump(): void {
    this.version += 1;
  }
}

export const activeEditorStore = new ActiveEditorStore();
