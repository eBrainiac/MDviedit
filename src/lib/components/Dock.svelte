<script lang="ts">
  import FilePlus from "@lucide/svelte/icons/file-plus";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Save from "@lucide/svelte/icons/save";
  import SaveAll from "@lucide/svelte/icons/save-all";
  import X from "@lucide/svelte/icons/x";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import Settings from "@lucide/svelte/icons/settings";
  import GripVertical from "@lucide/svelte/icons/grip-vertical";
  import GripHorizontal from "@lucide/svelte/icons/grip-horizontal";
  import { preferences } from "../stores/preferences.svelte";
  import { tabsStore } from "../stores/tabs.svelte";
  import { appConfig, type DockPosition } from "../../config/app.config";
  import { t } from "../../i18n";
  import { formatShortcut } from "../format-shortcut";

  let { onDragStart }: { onDragStart: (event: PointerEvent) => void } = $props();

  const orientation = $derived(
    preferences.dockPosition === "top" || preferences.dockPosition === "bottom" ? "row" : "column",
  );

  const activeTab = $derived(tabsStore.active);
  const canSave = $derived(activeTab?.kind === "file");
  const canClose = $derived(activeTab !== null);

  const themeLabel = $derived(
    preferences.themeMode === "system"
      ? t("preferences.themeModeSystem")
      : preferences.themeMode === "light"
        ? t("preferences.themeModeLight")
        : t("preferences.themeModeDark"),
  );

  let menuOpen = $state(false);

  function closeMenu(): void {
    menuOpen = false;
  }

  function openMenu(event: MouseEvent): void {
    event.preventDefault();
    menuOpen = true;
  }

  function choosePosition(position: DockPosition): void {
    preferences.setDockPosition(position);
    closeMenu();
  }

  $effect(() => {
    if (!menuOpen) return;
    function onKeydown(event: KeyboardEvent): void {
      if (event.key === "Escape") closeMenu();
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });

  const positions: readonly { value: DockPosition; label: string }[] = [
    { value: "right", label: t("preferences.dockPositionRight") },
    { value: "left", label: t("preferences.dockPositionLeft") },
    { value: "top", label: t("preferences.dockPositionTop") },
    { value: "bottom", label: t("preferences.dockPositionBottom") },
  ];
</script>

<nav
  class="dock"
  data-position={preferences.dockPosition}
  data-orientation={orientation}
  aria-label={t("dock.label")}
  oncontextmenu={openMenu}
>
  <button
    type="button"
    class="dock-btn"
    title={`${t("dock.new")} (${formatShortcut(appConfig.shortcuts.newFile)})`}
    aria-label={t("dock.new")}
    onclick={() => tabsStore.newTab()}
  >
    <FilePlus class="dock-icon" aria-hidden="true" />
  </button>
  <button
    type="button"
    class="dock-btn"
    title={`${t("dock.open")} (${formatShortcut(appConfig.shortcuts.open)})`}
    aria-label={t("dock.open")}
    onclick={() => tabsStore.openDialog()}
  >
    <FolderOpen class="dock-icon" aria-hidden="true" />
  </button>
  <button
    type="button"
    class="dock-btn"
    title={`${t("dock.save")} (${formatShortcut(appConfig.shortcuts.save)})`}
    aria-label={t("dock.save")}
    disabled={!canSave}
    onclick={() => activeTab && tabsStore.save(activeTab.id)}
  >
    <Save class="dock-icon" aria-hidden="true" />
  </button>
  <button
    type="button"
    class="dock-btn"
    title={`${t("dock.saveAs")} (${formatShortcut(appConfig.shortcuts.saveAs)})`}
    aria-label={t("dock.saveAs")}
    disabled={!canSave}
    onclick={() => activeTab && tabsStore.saveAs(activeTab.id)}
  >
    <SaveAll class="dock-icon" aria-hidden="true" />
  </button>
  <button
    type="button"
    class="dock-btn"
    title={`${t("dock.close")} (${formatShortcut(appConfig.shortcuts.closeTab)})`}
    aria-label={t("dock.close")}
    disabled={!canClose}
    onclick={() => activeTab && tabsStore.close(activeTab.id)}
  >
    <X class="dock-icon" aria-hidden="true" />
  </button>

  <div class="dock-separator" aria-hidden="true"></div>

  <button
    type="button"
    class="dock-btn"
    title={`${t("dock.theme")}: ${themeLabel} (${formatShortcut(appConfig.shortcuts.toggleTheme)})`}
    aria-label={t("dock.theme")}
    onclick={() => preferences.cycleThemeMode()}
  >
    {#if preferences.resolvedTheme === "dark"}
      <Moon class="dock-icon" aria-hidden="true" />
    {:else}
      <Sun class="dock-icon" aria-hidden="true" />
    {/if}
  </button>
  <button
    type="button"
    class="dock-btn"
    title={`${t("dock.preferences")} (${formatShortcut(appConfig.shortcuts.preferences)})`}
    aria-label={t("dock.preferences")}
    onclick={() => tabsStore.openPreferences()}
  >
    <Settings class="dock-icon" aria-hidden="true" />
  </button>

  <button type="button" class="dock-grip" title={t("dock.dragHandle")} onpointerdown={onDragStart}>
    {#if orientation === "column"}
      <GripVertical class="dock-icon" aria-hidden="true" />
    {:else}
      <GripHorizontal class="dock-icon" aria-hidden="true" />
    {/if}
  </button>

  {#if menuOpen}
    <button type="button" class="menu-backdrop" aria-label={t("dialog.cancel")} onclick={closeMenu}></button>
    <ul class="dock-menu" role="menu" aria-label={t("dock.menuLabel")}>
      {#each positions as option (option.value)}
        <li role="none">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={preferences.dockPosition === option.value}
            class="dock-menu-item"
            class:selected={preferences.dockPosition === option.value}
            onclick={() => choosePosition(option.value)}
          >
            {option.label}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</nav>

<style>
  .dock {
    box-sizing: border-box;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    width: var(--dock-w);
    height: 100%;
    padding: var(--space-2) 0;
    background: var(--c-bg-elev);
  }

  .dock[data-position="right"] {
    border-left: var(--border-w) solid var(--c-border);
  }

  .dock[data-position="left"] {
    border-right: var(--border-w) solid var(--c-border);
  }

  .dock[data-position="top"],
  .dock[data-position="bottom"] {
    width: 100%;
    height: var(--dock-h);
    flex-direction: row;
    padding: 0 var(--space-2);
  }

  .dock[data-position="top"] {
    border-bottom: var(--border-w) solid var(--c-border);
  }

  .dock[data-position="bottom"] {
    border-top: var(--border-w) solid var(--c-border);
  }

  .dock-btn {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: var(--btn-size);
    height: var(--btn-size);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--c-text);
    cursor: pointer;
  }

  .dock-btn:disabled {
    color: var(--c-text-muted);
    cursor: default;
    opacity: 0.5;
  }

  .dock-btn:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  .dock-btn:hover:not(:disabled) {
    background: var(--c-bg-hover);
  }

  .dock-btn:active:not(:disabled) {
    background: var(--c-accent-soft);
  }

  .dock-separator {
    width: 100%;
    height: var(--border-w);
    margin: var(--space-1) 0;
    background: var(--c-border);
  }

  .dock[data-orientation="row"] .dock-separator {
    width: var(--border-w);
    height: 100%;
    margin: 0 var(--space-1);
  }

  .dock-grip {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: var(--btn-size);
    height: var(--btn-size);
    margin-top: auto;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--c-text-muted);
    cursor: grab;
  }

  .dock-grip:hover {
    background: var(--c-bg-hover);
  }

  .dock-grip:active {
    cursor: grabbing;
  }

  .dock[data-orientation="row"] .dock-grip {
    margin-top: 0;
    margin-left: auto;
  }

  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-popover);
    border: none;
    background: transparent;
    cursor: default;
  }

  .dock-menu {
    position: absolute;
    z-index: calc(var(--z-popover) + 1);
    margin: 0;
    padding: var(--space-1) 0;
    list-style: none;
    background: var(--c-bg-elev);
    border: var(--border-w) solid var(--c-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-popover);
  }

  .dock[data-position="right"] .dock-menu {
    top: 0;
    right: calc(100% + var(--space-1));
  }

  .dock[data-position="left"] .dock-menu {
    top: 0;
    left: calc(100% + var(--space-1));
  }

  .dock[data-position="top"] .dock-menu {
    top: calc(100% + var(--space-1));
    left: 0;
  }

  .dock[data-position="bottom"] .dock-menu {
    bottom: calc(100% + var(--space-1));
    left: 0;
  }

  .dock-menu-item {
    display: block;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: none;
    background: transparent;
    color: var(--c-text);
    font: inherit;
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
  }

  .dock-menu-item:hover {
    background: var(--c-bg-hover);
  }

  .dock-menu-item.selected {
    color: var(--c-accent);
  }

  :global(.dock-icon) {
    width: var(--icon-size);
    height: var(--icon-size);
  }
</style>
