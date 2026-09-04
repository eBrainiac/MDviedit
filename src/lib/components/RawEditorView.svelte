<script lang="ts">
  import { untrack } from "svelte";
  import { Compartment, EditorState, type Extension } from "@codemirror/state";
  import { EditorView, keymap, lineNumbers } from "@codemirror/view";
  import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
  import { markdown } from "@codemirror/lang-markdown";
  import { syntaxHighlighting } from "@codemirror/language";
  import { createEditorTheme, markdownHighlightStyle } from "../editor/codemirror-theme";
  import type { Tab } from "../stores/tabs.svelte";
  import { tabsStore } from "../stores/tabs.svelte";
  import { preferences } from "../stores/preferences.svelte";
  import { activeEditorStore } from "../stores/active-editor.svelte";
  import { appConfig } from "../../config/app.config";

  let { tab }: { tab: Tab } = $props();

  let containerEl: HTMLDivElement | undefined = $state();
  let view: EditorView | undefined;
  const lineNumbersCompartment = new Compartment();

  function zoomBy(delta: number): boolean {
    preferences.setEditorFontSize(preferences.editorFontSize + delta);
    return true;
  }

  function zoomReset(): boolean {
    preferences.setEditorFontSize(appConfig.preferencesDefaults.editorFontSize);
    return true;
  }

  function buildExtensions(): Extension[] {
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
      markdown(),
      syntaxHighlighting(markdownHighlightStyle),
      createEditorTheme(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) tabsStore.setContent(tab.id, update.state.doc.toString());
        if (update.docChanged || update.selectionSet) activeEditorStore.bump();
      }),
    ];
  }

  $effect(() => {
    if (!containerEl) return;

    const state =
      untrack(() => tab.editorState) ?? EditorState.create({ doc: untrack(() => tab.text), extensions: buildExtensions() });
    const editorView = new EditorView({ state, parent: containerEl });
    view = editorView;
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
