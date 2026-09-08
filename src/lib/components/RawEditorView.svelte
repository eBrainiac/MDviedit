<script lang="ts">
  import { untrack } from "svelte";
  import { Compartment, EditorState, type Extension } from "@codemirror/state";
  import { EditorView, keymap, lineNumbers } from "@codemirror/view";
  import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
  import { markdown } from "@codemirror/lang-markdown";
  import { syntaxHighlighting } from "@codemirror/language";
  import { createEditorTheme, codeHighlightStyle, markdownHighlightStyle } from "../editor/codemirror-theme";
  import { loadLanguageExtension } from "../editor/language-loader";
  import type { Tab } from "../stores/tabs.svelte";
  import { tabsStore } from "../stores/tabs.svelte";
  import { preferences } from "../stores/preferences.svelte";
  import { activeEditorStore } from "../stores/active-editor.svelte";
  import { appConfig, fileTypeForPath } from "../../config/app.config";

  let { tab }: { tab: Tab } = $props();

  let containerEl: HTMLDivElement | undefined = $state();
  let view: EditorView | undefined;
  const lineNumbersCompartment = new Compartment();
  const languageCompartment = new Compartment();
  const highlightCompartment = new Compartment();

  function zoomBy(delta: number): boolean {
    preferences.setEditorFontSize(preferences.editorFontSize + delta);
    return true;
  }

  function zoomReset(): boolean {
    preferences.setEditorFontSize(appConfig.preferencesDefaults.editorFontSize);
    return true;
  }

  // BL-126/ADR-013: (re)carga el lenguaje de un editor ya montado según la
  // ruta actual — se llama al crear el editor y de nuevo cada vez que
  // `tab.path` cambia mientras sigue montado (p. ej. Guardar como de una
  // pestaña nueva eligiendo `.py`; la vista Sin formato es la única para
  // código, PD-86, así que no hay cambio de `viewMode` que remonte por
  // `{#key}` de ContentArea). `targetView` se compara contra `view` tras el
  // `await` para no aplicar un reconfigure a un editor ya destruido.
  function applyLanguage(targetView: EditorView, path: string | null): void {
    const fileType = fileTypeForPath(path);
    if (fileType.editMode === "markdown") {
      targetView.dispatch({
        effects: [
          languageCompartment.reconfigure([markdown()]),
          highlightCompartment.reconfigure(syntaxHighlighting(markdownHighlightStyle)),
        ],
      });
      return;
    }
    void loadLanguageExtension(fileType.languagePackage).then((extension) => {
      if (view !== targetView) return;
      targetView.dispatch({
        effects: [
          languageCompartment.reconfigure(extension),
          highlightCompartment.reconfigure(syntaxHighlighting(codeHighlightStyle)),
        ],
      });
    });
  }

  // BL-125/ADR-013: pestañas Markdown siguen con `markdown()` estático
  // (comportamiento actual, sin cambios); pestañas de código arrancan sin
  // lenguaje — el efecto de más abajo lo carga vía import() dinámico
  // (NFR-008) apenas el editor existe.
  function buildExtensions(initialPath: string | null): Extension[] {
    const fileType = fileTypeForPath(initialPath);
    return [
      lineNumbersCompartment.of(preferences.lineNumbers ? [lineNumbers()] : []),
      history(),
      // UI-SCREENS §3: ajuste de línea activado por defecto.
      EditorView.lineWrapping,
      keymap.of([
        ...historyKeymap,
        ...defaultKeymap,
        { key: "Mod-=", run: () => zoomBy(appConfig.behavior.editorFontSizeStep) },
        { key: "Mod--", run: () => zoomBy(-appConfig.behavior.editorFontSizeStep) },
        { key: "Mod-0", run: zoomReset },
      ]),
      languageCompartment.of(fileType.editMode === "markdown" ? [markdown()] : []),
      highlightCompartment.of(
        syntaxHighlighting(fileType.editMode === "markdown" ? markdownHighlightStyle : codeHighlightStyle),
      ),
      createEditorTheme(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) tabsStore.setContent(tab.id, update.state.doc.toString());
        if (update.docChanged || update.selectionSet) activeEditorStore.bump();
      }),
    ];
  }

  $effect(() => {
    if (!containerEl) return;

    const initialPath = untrack(() => tab.path);
    const state =
      untrack(() => tab.editorState) ??
      EditorState.create({ doc: untrack(() => tab.text), extensions: buildExtensions(initialPath) });
    const editorView = new EditorView({ state, parent: containerEl });
    view = editorView;
    applyLanguage(editorView, initialPath);
    editorView.scrollDOM.scrollTop = untrack(() => tab.scroll);
    // Ojo: no llamar aquí a activeEditorStore.bump() además de reasignar
    // `current` — construir un EditorView nuevo dispara `updateListener`
    // (línea de abajo) de forma síncrona, y encadenar ambos writes de
    // `activeEditorStore` en el mismo tick fuerza effect_update_depth_exceeded
    // y congela la reactividad de toda la página. Reasignar `current` ya
    // invalida el $derived.by de FormatToolbar sin necesidad de bump().
    activeEditorStore.current = { kind: "raw", view: editorView };

    function onScroll(): void {
      tabsStore.setScroll(tab.id, editorView.scrollDOM.scrollTop);
    }
    editorView.scrollDOM.addEventListener("scroll", onScroll, { passive: true });

    if (untrack(() => tab.focusOnMount)) {
      editorView.focus();
      tabsStore.consumeFocusOnMount(tab.id);
    }

    return () => {
      editorView.scrollDOM.removeEventListener("scroll", onScroll);
      tabsStore.setEditorState(tab.id, editorView.state);
      tabsStore.setScroll(tab.id, editorView.scrollDOM.scrollTop);
      editorView.destroy();
      view = undefined;
      if (activeEditorStore.current?.kind === "raw" && activeEditorStore.current.view === editorView) {
        activeEditorStore.current = null;
      }
    };
  });

  // BL-126/ADR-013: si la ruta de la pestaña cambia mientras el editor sigue
  // montado (p. ej. Guardar como de una pestaña nueva eligiendo `.py`), se
  // recarga el paquete de lenguaje correspondiente sin remontar — la vista
  // Sin formato es la única para código (PD-86), así que no hay cambio de
  // `viewMode` que dispare el remonte por `{#key}` de ContentArea. El mount
  // ya llama a `applyLanguage` una vez con la ruta inicial; este efecto solo
  // reacciona a cambios posteriores (se ignora silenciosamente si `view`
  // todavía no existe en la primera pasada — el mount se encarga de esa).
  $effect(() => {
    const path = tab.path;
    if (view) applyLanguage(view, path);
  });

  // BL-021: números de línea reactivos a la preferencia (Compartment, sin
  // recrear el editor). Todavía no hay switch en Preferencias (IT-5) pero
  // ya queda cableado.
  $effect(() => {
    const enabled = preferences.lineNumbers;
    view?.dispatch({ effects: lineNumbersCompartment.reconfigure(enabled ? [lineNumbers()] : []) });
  });
</script>

<div class="raw-editor" bind:this={containerEl}></div>

<style>
  .raw-editor {
    height: 100%;
    overflow: hidden;
  }

  .raw-editor :global(.cm-editor) {
    height: 100%;
  }

  .raw-editor :global(.cm-scroller) {
    overflow: auto;
  }
</style>
