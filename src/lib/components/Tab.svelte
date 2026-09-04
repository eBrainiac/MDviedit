<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import Settings from "@lucide/svelte/icons/settings";
  import { revealItemInDir } from "@tauri-apps/plugin-opener";
  import type { Tab as TabData } from "../stores/tabs.svelte";
  import { tabsStore } from "../stores/tabs.svelte";
  import { getTabDefaultWidthPx } from "../../config/css-tokens";
  import { isMacPlatform } from "../shortcut-match";
  import { t } from "../../i18n";

  let {
    tab,
    active,
    dragging,
    onActivate,
    onClose,
    onResizeStart,
    onReorderStart,
  }: {
    tab: TabData;
    active: boolean;
    dragging: boolean;
    onActivate: () => void;
    onClose: () => void;
    onResizeStart: (event: PointerEvent) => void;
    onReorderStart: (event: PointerEvent) => void;
  } = $props();

  let hovering = $state(false);
  let menuOpen = $state(false);

  // TAB-001: nombre truncado conservando la extensión visible (ancho de
  // pestaña actual = --tab-default-w, siempre >= tabEllipsisKeepExtMinPx
  // hasta que IT-4 agregue redimensionado).
  const dotIndex = $derived(tab.title.lastIndexOf("."));
  const stem = $derived(dotIndex > 0 ? tab.title.slice(0, dotIndex) : tab.title);
  const ext = $derived(dotIndex > 0 ? tab.title.slice(dotIndex) : "");

  const canFileAction = $derived(tab.kind === "file" && tab.path !== null);

  function handleMouseDown(event: MouseEvent): void {
    // IN-021: clic medio cierra la pestaña.
    if (event.button === 1) {
      event.preventDefault();
      onClose();
    }
  }

  function closeMenu(): void {
    menuOpen = false;
  }

  // IN-026: clic derecho abre el menú contextual (UI-SCREENS §5).
  function openMenu(event: MouseEvent): void {
    event.preventDefault();
    menuOpen = true;
  }

  function handleResizeDblClick(event: MouseEvent): void {
    event.stopPropagation();
    tabsStore.setWidth(tab.id, getTabDefaultWidthPx());
  }

  async function handleCopyPath(): Promise<void> {
    closeMenu();
    if (tab.path) await navigator.clipboard.writeText(tab.path);
  }

  async function handleShowInFolder(): Promise<void> {
    closeMenu();
    if (tab.path) await revealItemInDir(tab.path);
  }

  $effect(() => {
    if (!menuOpen) return;
    function onKeydown(event: KeyboardEvent): void {
      if (event.key === "Escape") closeMenu();
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });
</script>

<!--
  Grupo visual de los dos botones reales (activar/cerrar) — pointerenter/leave
  solo cambian el estado de hover del punto dirty (TAB-004) y mousedown solo
  agrega el atajo de clic medio (IN-021), ambos supletorios a los botones.
-->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="tab"
  class:active
  class:dragging
  role="group"
  aria-label={tab.title}
  data-tab-id={tab.id}
  style:width={tab.width !== null ? `${tab.width}px` : null}
  onpointerenter={() => (hovering = true)}
  onpointerleave={() => (hovering = false)}
  onmousedown={handleMouseDown}
  oncontextmenu={openMenu}
  title={tab.path ?? tab.title}
>
  <button type="button" class="tab-activate" onclick={onActivate} onpointerdown={onReorderStart}>
    {#if tab.kind === "preferences"}
      <Settings class="tab-icon" aria-hidden="true" />
    {/if}
    <span class="tab-title">
      <span class="tab-stem">{stem}</span><span class="tab-ext">{ext}</span>
    </span>
  </button>
  <button type="button" class="tab-close" aria-label={t("dock.close")} onclick={onClose}>
    {#if tab.dirty && !hovering}
      <span class="dirty-dot" aria-hidden="true">●</span>
    {:else}
      <X class="tab-icon-sm" aria-hidden="true" />
    {/if}
  </button>
  <!-- TAB-011/012: borde derecho arrastrable (col-resize); doble clic restaura --tab-default-w. -->
  <div
    class="tab-resize-handle"
    role="separator"
    aria-orientation="vertical"
    aria-label={t("tab.resizeHandle")}
    onpointerdown={onResizeStart}
    ondblclick={handleResizeDblClick}
  ></div>

  {#if menuOpen}
    <button type="button" class="menu-backdrop" aria-label={t("dialog.cancel")} onclick={closeMenu}></button>
    <ul class="tab-menu" role="menu" aria-label={t("tab.menuLabel")}>
      <li role="none">
        <button
          type="button"
          role="menuitem"
          class="tab-menu-item"
          onclick={() => {
            closeMenu();
            onClose();
          }}
        >
          {t("tab.close")}
        </button>
      </li>
      <li role="none">
        <button
          type="button"
          role="menuitem"
          class="tab-menu-item"
          onclick={() => {
            closeMenu();
            void tabsStore.closeOthers(tab.id);
          }}
        >
          {t("tab.closeOthers")}
        </button>
      </li>
      <li role="none">
        <button
          type="button"
          role="menuitem"
          class="tab-menu-item"
          onclick={() => {
            closeMenu();
            void tabsStore.closeAll();
          }}
        >
          {t("tab.closeAll")}
        </button>
      </li>
      <li role="none">
        <button
          type="button"
          role="menuitem"
          class="tab-menu-item"
          onclick={() => {
            closeMenu();
            void tabsStore.closeRight(tab.id);
          }}
        >
          {t("tab.closeRight")}
        </button>
      </li>
      <li role="none">
        <button type="button" role="menuitem" class="tab-menu-item" disabled={!canFileAction} onclick={handleCopyPath}>
          {t("tab.copyPath")}
        </button>
      </li>
      <li role="none">
        <button
          type="button"
          role="menuitem"
          class="tab-menu-item"
          disabled={!canFileAction}
          onclick={handleShowInFolder}
        >
          {isMacPlatform() ? t("tab.showInFolderMac") : t("tab.showInFolderWin")}
        </button>
      </li>
    </ul>
  {/if}
</div>

<style>
  .tab {
    box-sizing: border-box;
    position: relative;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    width: var(--tab-default-w);
    min-width: var(--tab-min-w);
    height: var(--tabbar-h);
    border-top: var(--tab-indicator-h) solid transparent;
    border-right: var(--border-w) solid var(--c-border);
    background: var(--c-bg-elev);
    color: var(--c-text-muted);
  }

  .tab.active {
    border-top-color: var(--c-accent);
    background: var(--c-bg-active);
    color: var(--c-text);
  }

  .tab.dragging {
    opacity: 0.6;
    cursor: grabbing;
  }

  .tab-activate {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: center;
    gap: var(--space-1);
    height: 100%;
    padding: 0 0 0 var(--space-2);
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: default;
  }

  .tab-title {
    display: flex;
    min-width: 0;
    flex: 1;
  }

  .tab-stem {
    overflow: hidden;
    min-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tab-ext {
    flex-shrink: 0;
    white-space: nowrap;
  }

  .tab-close {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: var(--btn-size);
    height: var(--btn-size);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .tab-close:hover {
    background: var(--c-bg-hover);
  }

  .tab-close:focus-visible,
  .tab-activate:focus-visible {
    outline: var(--focus-ring);
    outline-offset: calc(var(--focus-ring-offset) * -1);
  }

  .dirty-dot {
    color: var(--c-dirty);
  }

  .tab-resize-handle {
    position: absolute;
    top: 0;
    right: calc(var(--tab-resize-handle-w) / -2);
    width: var(--tab-resize-handle-w);
    height: 100%;
    cursor: col-resize;
    touch-action: none;
  }

  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-popover);
    border: none;
    background: transparent;
    cursor: default;
  }

  .tab-menu {
    /* TabBar vive en la fila inferior (encima de StatusBar): a diferencia
       del menú de Dock/FormatToolbar, aquí no hay espacio debajo — se abre
       hacia arriba (bottom: 100%), nunca hacia abajo. */
    position: absolute;
    bottom: 100%;
    left: 0;
    z-index: calc(var(--z-popover) + 1);
    margin: 0 0 var(--space-1);
    padding: var(--space-1) 0;
    list-style: none;
    background: var(--c-bg-elev);
    border: var(--border-w) solid var(--c-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-popover);
    white-space: nowrap;
  }

  .tab-menu-item {
    display: block;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: none;
    background: transparent;
    color: var(--c-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .tab-menu-item:disabled {
    color: var(--c-text-muted);
    cursor: default;
    opacity: 0.5;
  }

  .tab-menu-item:hover:not(:disabled) {
    background: var(--c-bg-hover);
  }

  :global(.tab-icon) {
    width: var(--icon-size);
    height: var(--icon-size);
  }

  :global(.tab-icon-sm) {
    width: var(--icon-size);
    height: var(--icon-size);
  }
</style>
