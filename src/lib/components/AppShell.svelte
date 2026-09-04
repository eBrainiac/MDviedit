<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { preferences } from "../stores/preferences.svelte";
  import { tabsStore } from "../stores/tabs.svelte";
  import { activeEditorStore } from "../stores/active-editor.svelte";
  import { syncFileWatchers } from "../stores/file-watch";
  import { appConfig, type DockPosition } from "../../config/app.config";
  import { matchesShortcut } from "../shortcut-match";
  import { formatCommands, headingLevels, headingClearCommand } from "../editor/format-commands";
  import { t } from "../../i18n";
  import Dock from "./Dock.svelte";
  import TopRow from "./TopRow.svelte";
  import ContentArea from "./ContentArea.svelte";
  import TabBar from "./TabBar.svelte";
  import StatusBar from "./StatusBar.svelte";

  let rootEl: HTMLDivElement | undefined = $state();
  let dragging = $state(false);
  let dragCandidate = $state<DockPosition | null>(null);

  const EDGES: readonly DockPosition[] = ["left", "right", "top", "bottom"];

  function nearestEdge(rect: DOMRect, x: number, y: number): DockPosition | null {
    const zone = appConfig.behavior.dockDropZonePx;
    const distances: Record<DockPosition, number> = {
      left: x - rect.left,
      right: rect.right - x,
      top: y - rect.top,
      bottom: rect.bottom - y,
    };
    const withinZone = EDGES.filter((edge) => distances[edge] >= 0 && distances[edge] <= zone);
    if (withinZone.length === 0) return null;
    return withinZone.reduce((closest, edge) => (distances[edge] < distances[closest] ? edge : closest));
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!rootEl) return;
    dragCandidate = nearestEdge(rootEl.getBoundingClientRect(), event.clientX, event.clientY);
  }

  function stopDragging(): void {
    dragging = false;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }

  function handlePointerUp(): void {
    if (dragCandidate) preferences.setDockPosition(dragCandidate);
    dragCandidate = null;
    stopDragging();
  }

  function handleDragStart(): void {
    dragging = true;
    dragCandidate = null;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  // NFR-006 / UI-TOUCH-CONTROLS §4: atajos globales.
  const shortcuts = appConfig.shortcuts;
  // IN-015: los atajos de FormatToolbar funcionan aunque esté oculta.
  const allFormatCommands = [...formatCommands, ...headingLevels, headingClearCommand];

  function handleGlobalKeydown(event: KeyboardEvent): void {
    const activeTab = tabsStore.active;

    if (matchesShortcut(event, shortcuts.toggleView)) {
      event.preventDefault();
      if (activeTab?.kind === "file") {
        tabsStore.setViewMode(activeTab.id, activeTab.viewMode === "raw" ? "formatted" : "raw");
      }
      return;
    }
    if (matchesShortcut(event, shortcuts.toggleFormatToolbar)) {
      event.preventDefault();
      preferences.toggleFormatToolbarVisible();
      return;
    }
    if (activeTab?.kind === "file") {
      const formatCommand = allFormatCommands.find((cmd) => cmd.shortcut && matchesShortcut(event, cmd.shortcut));
      if (formatCommand) {
        event.preventDefault();
        formatCommand.run(activeEditorStore.current);
        return;
      }
    }

    if (matchesShortcut(event, shortcuts.newFile)) {
      event.preventDefault();
      tabsStore.newTab();
    } else if (matchesShortcut(event, shortcuts.open)) {
      event.preventDefault();
      void tabsStore.openDialog();
    } else if (matchesShortcut(event, shortcuts.save)) {
      event.preventDefault();
      if (activeTab?.kind === "file") void tabsStore.save(activeTab.id);
    } else if (matchesShortcut(event, shortcuts.saveAs)) {
      event.preventDefault();
      if (activeTab?.kind === "file") void tabsStore.saveAs(activeTab.id);
    } else if (matchesShortcut(event, shortcuts.closeTab)) {
      event.preventDefault();
      if (activeTab) void tabsStore.close(activeTab.id);
    } else if (matchesShortcut(event, shortcuts.zoomIn)) {
      event.preventDefault();
      preferences.setEditorFontSize(preferences.editorFontSize + appConfig.behavior.editorFontSizeStep);
    } else if (matchesShortcut(event, shortcuts.zoomOut)) {
      event.preventDefault();
      preferences.setEditorFontSize(preferences.editorFontSize - appConfig.behavior.editorFontSizeStep);
    } else if (matchesShortcut(event, shortcuts.zoomReset)) {
      event.preventDefault();
      preferences.setEditorFontSize(appConfig.preferencesDefaults.editorFontSize);
    } else if (matchesShortcut(event, shortcuts.toggleTheme)) {
      event.preventDefault();
      preferences.cycleThemeMode();
    } else if (matchesShortcut(event, shortcuts.preferences)) {
      event.preventDefault();
      tabsStore.openPreferences();
    }
  }

  $effect(() => {
    window.addEventListener("keydown", handleGlobalKeydown, { capture: true });
    return () => window.removeEventListener("keydown", handleGlobalKeydown, { capture: true });
  });

  // UI-SCREENS §1: "{archivo} — MDviedit" / sin pestañas: "MDviedit".
  $effect(() => {
    const activeTab = tabsStore.active;
    const title =
      activeTab && activeTab.kind === "file"
        ? t("window.titleWithFile", { file: activeTab.title })
        : t("window.titleEmpty");
    // getCurrentWindow() puede lanzar de forma síncrona fuera del webview
    // de Tauri; nunca debe interrumpir el efecto ni el resto de la app.
    try {
      getCurrentWindow()
        .setTitle(title)
        .catch(() => {});
    } catch {
      // no-op
    }
  });

  // SPEC-CORE-019 / SEC-010: sincroniza los watchers de fs con las rutas
  // abiertas y la preferencia watchFiles en cada cambio de cualquiera.
  $effect(() => {
    const openPaths = tabsStore.tabs.filter((tab) => tab.kind === "file" && tab.path !== null).map((tab) => tab.path as string);
    const enabled = preferences.watchFiles;
    void syncFileWatchers(openPaths, enabled);
  });
</script>

<!-- BL-010: grid ancladas (ADR-012), sin coordenadas absolutas. -->
<div class="app-shell" data-dock-position={preferences.dockPosition} bind:this={rootEl}>
  <TopRow />
  <ContentArea />
  <TabBar />
  <StatusBar />
  <Dock onDragStart={handleDragStart} />

  {#if dragging}
    <div class="drop-zones" aria-hidden="true">
      {#each EDGES as edge (edge)}
        <div class="drop-zone drop-zone-{edge}" class:active={dragCandidate === edge}></div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .app-shell {
    position: relative;
    display: grid;
    width: 100%;
    height: 100vh;
  }

  .app-shell[data-dock-position="right"] {
    grid-template-areas: "top dock" "content dock" "tabs dock" "status status";
    grid-template-columns: 1fr var(--dock-w);
    grid-template-rows: var(--bar-h) 1fr var(--tabbar-h) var(--statusbar-h);
  }

  .app-shell[data-dock-position="left"] {
    grid-template-areas: "dock top" "dock content" "dock tabs" "status status";
    grid-template-columns: var(--dock-w) 1fr;
    grid-template-rows: var(--bar-h) 1fr var(--tabbar-h) var(--statusbar-h);
  }

  .app-shell[data-dock-position="top"] {
    grid-template-areas: "dock" "top" "content" "tabs" "status";
    grid-template-columns: 1fr;
    grid-template-rows: var(--dock-h) var(--bar-h) 1fr var(--tabbar-h) var(--statusbar-h);
  }

  .app-shell[data-dock-position="bottom"] {
    grid-template-areas: "top" "content" "tabs" "dock" "status";
    grid-template-columns: 1fr;
    grid-template-rows: var(--bar-h) 1fr var(--tabbar-h) var(--dock-h) var(--statusbar-h);
  }

  .app-shell > :global(.top-row) {
    grid-area: top;
  }

  .app-shell > :global(.content-area) {
    grid-area: content;
    min-height: 0;
  }

  .app-shell > :global(.tab-bar) {
    grid-area: tabs;

    /* Igual que .content-area con min-height: sin esto, la fila 1fr crece
       para caber el min-content de todas las pestañas sin encoger (TAB-013:
       deben activar el overflow del carril, no expandir la fila). */
    min-width: 0;
  }

  .app-shell > :global(.status-bar) {
    grid-area: status;
  }

  .app-shell > :global(.dock) {
    grid-area: dock;
  }

  /* DOCK-003: franjas de dockDropZonePx resaltadas durante el arrastre. */
  .drop-zones {
    position: absolute;
    inset: 0;
    z-index: var(--z-popover);
    pointer-events: none;
  }

  .drop-zone {
    position: absolute;
    background: var(--c-accent-soft);
    opacity: 0;
    transition: opacity var(--dur-fast) var(--ease);
  }

  .drop-zone.active {
    opacity: 1;
  }

  .drop-zone-left {
    top: 0;
    left: 0;
    width: var(--dock-w);
    height: 100%;
  }

  .drop-zone-right {
    top: 0;
    right: 0;
    width: var(--dock-w);
    height: 100%;
  }

  .drop-zone-top {
    top: 0;
    left: 0;
    width: 100%;
    height: var(--dock-h);
  }

  .drop-zone-bottom {
    bottom: 0;
    left: 0;
    width: 100%;
    height: var(--dock-h);
  }
</style>
