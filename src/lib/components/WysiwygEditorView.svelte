<script lang="ts">
  import type { Editor as MilkdownEditor } from "@milkdown/core";
  import type { Tab } from "../stores/tabs.svelte";
  import { tabsStore } from "../stores/tabs.svelte";
  import { activeEditorStore } from "../stores/active-editor.svelte";
  import { remarkStringifyOptions } from "../editor/milkdown-setup";

  let { tab }: { tab: Tab } = $props();

  let containerEl: HTMLDivElement | undefined = $state();

  function dirnameOf(path: string): string {
    const normalized = path.replaceAll("\\", "/");
    return normalized.slice(0, normalized.lastIndexOf("/"));
  }

  $effect(() => {
    if (!containerEl) return;
    let cancelled = false;
    let editor: MilkdownEditor | undefined;
    let scrollEl: HTMLElement | undefined;
    let onScroll: (() => void) | undefined;

    void (async () => {
      // MEM-004/BL-030: Milkdown se carga con import() dinámico, solo la
      // primera vez que una pestaña entra en vista Formato.
      const [
        { Editor, rootCtx, defaultValueCtx, remarkStringifyOptionsCtx, editorViewCtx },
        { commonmark },
        { gfm },
        { history },
        { clipboard },
        { listener, listenerCtx },
        { cursor },
        { frontmatter },
        { imageNodeView, imageContext },
        { htmlNodeView },
        { externalLinkPlugin },
      ] = await Promise.all([
        import("@milkdown/core"),
        import("@milkdown/preset-commonmark"),
        import("@milkdown/preset-gfm"),
        import("@milkdown/plugin-history"),
        import("@milkdown/plugin-clipboard"),
        import("@milkdown/plugin-listener"),
        import("@milkdown/plugin-cursor"),
        import("../editor/frontmatter-plugin"),
        import("../editor/image-node-view"),
        import("../editor/html-node-view"),
        import("../editor/external-link-plugin"),
      ]);

      if (cancelled || !containerEl) return;

      imageContext.baseDir = tab.path ? dirnameOf(tab.path) : null;

      let ready = false;
      editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, containerEl as HTMLElement);
          ctx.set(defaultValueCtx, tab.text);
          ctx.set(remarkStringifyOptionsCtx, remarkStringifyOptions);
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
            if (!ready) return;
            tabsStore.setContent(tab.id, markdown);
            activeEditorStore.bump();
          });
          // AT-002: el estado activo de los botones del toolbar depende de
          // la posición del cursor, no solo del contenido — hace falta
          // selectionUpdated además de markdownUpdated/updated.
          ctx.get(listenerCtx).selectionUpdated(() => activeEditorStore.bump());
        })
        .use(commonmark)
        .use(gfm)
        .use(frontmatter)
        .use(history)
        .use(clipboard)
        .use(listener)
        .use(cursor)
        .use(imageNodeView)
        .use(htmlNodeView)
        .use(externalLinkPlugin)
        .create();

      if (cancelled || !editor) {
        editor?.destroy();
        return;
      }
      ready = true;

      const view = editor.ctx.get(editorViewCtx);
      // Ver nota en RawEditorView.svelte: no encadenar bump() justo después
      // de reasignar `current` — puede disparar effect_update_depth_exceeded.
      activeEditorStore.current = { kind: "wysiwyg", editor };

      scrollEl = containerEl;
      scrollEl.scrollTop = tab.scroll;
      onScroll = () => {
        if (scrollEl) tabsStore.setScroll(tab.id, scrollEl.scrollTop);
      };
      scrollEl.addEventListener("scroll", onScroll, { passive: true });

      if (tab.focusOnMount) {
        view.focus();
        tabsStore.consumeFocusOnMount(tab.id);
      }
    })();

    return () => {
      cancelled = true;
      if (scrollEl && onScroll) scrollEl.removeEventListener("scroll", onScroll);
      editor?.destroy();
      if (activeEditorStore.current?.kind === "wysiwyg" && activeEditorStore.current.editor === editor) {
        activeEditorStore.current = null;
      }
    };
  });
</script>

<!--
  UI-SCREENS §3 / PD-41: ancho completo, sin --content-max-w. El historial
  de deshacer de Milkdown no se conserva entre cambios de pestaña (a
  diferencia de CodeMirror en RawEditorView) — ver desviación en el reporte
  de IT-3: Milkdown no ofrece una forma documentada de "desmontar la vista
  y conservar el EditorState" como CodeMirror, así que cada montaje
  reanaliza `tab.text`. El reinicio del undo al cambiar de VISTA ya está
  documentado (UI-SCREENS §3); esto lo extiende al cambio de PESTAÑA
  mientras se permanece en Formato.
-->
<div class="wysiwyg-editor" bind:this={containerEl}></div>

<style>
  .wysiwyg-editor {
    box-sizing: border-box;
    height: 100%;
    overflow: auto;
    padding: var(--space-4);
    color: var(--c-text);
    font-family: var(--font-content);
    font-size: var(--fs-content);
    line-height: var(--lh-content);
  }

  .wysiwyg-editor :global(.milkdown) {
    outline: none;
  }

  .wysiwyg-editor :global(.ProseMirror) {
    outline: none;
  }

  .wysiwyg-editor :global(h1) {
    font-size: calc(var(--fs-content) * var(--content-h1-scale));
  }

  .wysiwyg-editor :global(h2) {
    font-size: calc(var(--fs-content) * var(--content-h2-scale));
  }

  .wysiwyg-editor :global(h3) {
    font-size: calc(var(--fs-content) * var(--content-h3-scale));
  }

  .wysiwyg-editor :global(h4) {
    font-size: calc(var(--fs-content) * var(--content-h4-scale));
  }

  .wysiwyg-editor :global(h5),
  .wysiwyg-editor :global(h6) {
    font-size: calc(var(--fs-content) * var(--content-h5-scale));
  }

  .wysiwyg-editor :global(a) {
    color: var(--c-accent);
  }

  .wysiwyg-editor :global(blockquote) {
    margin: 0;
    padding-left: var(--space-3);
    border-left: var(--border-w) solid var(--c-border);
    color: var(--c-text-muted);
  }

  .wysiwyg-editor :global(code) {
    background: var(--c-code-bg);
    font-family: var(--font-mono);
  }

  .wysiwyg-editor :global(pre) {
    overflow: auto;
    padding: var(--space-3);
    background: var(--c-code-bg);
    font-family: var(--font-mono);
  }

  .wysiwyg-editor :global(pre code) {
    background: transparent;
  }

  .wysiwyg-editor :global(table) {
    border-collapse: collapse;
  }

  .wysiwyg-editor :global(th),
  .wysiwyg-editor :global(td) {
    border: var(--border-w) solid var(--c-border);
    padding: var(--space-1) var(--space-2);
  }

  .wysiwyg-editor :global(hr) {
    border: none;
    border-top: var(--border-w) solid var(--c-border);
  }

  .wysiwyg-editor :global(::selection) {
    background: var(--c-selection);
  }
</style>
