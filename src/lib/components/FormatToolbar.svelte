<script lang="ts">
  import Bold from "@lucide/svelte/icons/bold";
  import Italic from "@lucide/svelte/icons/italic";
  import Strikethrough from "@lucide/svelte/icons/strikethrough";
  import CodeIcon from "@lucide/svelte/icons/code";
  import Heading1 from "@lucide/svelte/icons/heading-1";
  import Heading2 from "@lucide/svelte/icons/heading-2";
  import Heading3 from "@lucide/svelte/icons/heading-3";
  import ListIcon from "@lucide/svelte/icons/list";
  import ListOrdered from "@lucide/svelte/icons/list-ordered";
  import ListChecks from "@lucide/svelte/icons/list-checks";
  import Quote from "@lucide/svelte/icons/quote";
  import LinkIcon from "@lucide/svelte/icons/link";
  import ImageIcon from "@lucide/svelte/icons/image";
  import SquareCode from "@lucide/svelte/icons/square-code";
  import TableIcon from "@lucide/svelte/icons/table";
  import Minus from "@lucide/svelte/icons/minus";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import type { Component } from "svelte";
  import { activeEditorStore } from "../stores/active-editor.svelte";
  import { breakpointStore } from "../stores/breakpoint.svelte";
  import { formatCommands, headingLevels, headingClearCommand, type FormatCommand } from "../editor/format-commands";
  import { formatShortcut } from "../format-shortcut";
  import { appConfig } from "../../config/app.config";
  import { t } from "../../i18n";

  const icons: Record<string, Component> = {
    bold: Bold,
    italic: Italic,
    strikethrough: Strikethrough,
    code: CodeIcon,
    "heading-1": Heading1,
    "heading-2": Heading2,
    "heading-3": Heading3,
    list: ListIcon,
    "list-ordered": ListOrdered,
    "list-checks": ListChecks,
    quote: Quote,
    link: LinkIcon,
    image: ImageIcon,
    "square-code": SquareCode,
    table: TableIcon,
    minus: Minus,
  };

  // IN-014: en `compact` (< 720px), solo caben los primeros N botones; el
  // resto pasa al popover "⋯" conservando el orden.
  const visibleCount = appConfig.behavior.toolbarCompactVisibleCount;
  const isCompact = $derived(breakpointStore.current === "compact");
  const visibleCommands = $derived(isCompact ? formatCommands.slice(0, visibleCount) : formatCommands);
  const overflowCommands = $derived(isCompact ? formatCommands.slice(visibleCount) : []);

  // Función, no $derived: `$derived`/`$derived.by` memoizan por igualdad de
  // referencia de SALIDA, y `activeEditorStore.current` no cambia de
  // referencia en cada pulsación/selección (solo `.version` lo hace) — así
  // que un $derived aquí nunca propagaría los bumps de versión a
  // isActive()/aria-pressed más abajo. Al ser función plana, cada lectura
  // de `editorSnapshot()` en la plantilla vuelve a suscribirse a `.version`.
  function editorSnapshot() {
    void activeEditorStore.version;
    return activeEditorStore.current;
  }

  let headingMenuOpen = $state(false);
  let overflowMenuOpen = $state(false);

  function runCommand(command: FormatCommand): void {
    command.run(editorSnapshot());
  }

  function closeMenus(): void {
    headingMenuOpen = false;
    overflowMenuOpen = false;
  }

  $effect(() => {
    if (!headingMenuOpen && !overflowMenuOpen) return;
    function onKeydown(event: KeyboardEvent): void {
      if (event.key === "Escape") closeMenus();
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });
</script>

<!-- SPEC-CORE-005 / UI-SCREENS §2: a la derecha del FormatToggle, con
     animación --dur-med (AppShell/TopRow controla el slide, ver estilos). -->
<div class="format-toolbar" role="toolbar" aria-label={t("dock.label")}>
  {#each visibleCommands as command (command.id)}
    {#if command.id === "heading"}
      <div class="heading-group">
        <button
          type="button"
          class="toolbar-btn"
          class:active={command.isActive(editorSnapshot())}
          title={t("toolbar.heading")}
          aria-label={t("toolbar.heading")}
          aria-haspopup="menu"
          aria-expanded={headingMenuOpen}
          onclick={() => (headingMenuOpen = !headingMenuOpen)}
        >
          <Heading1 class="toolbar-icon" aria-hidden="true" />
        </button>
        {#if headingMenuOpen}
          <button type="button" class="menu-backdrop" aria-label={t("dialog.cancel")} onclick={closeMenus}
          ></button>
          <ul class="heading-menu" role="menu">
            {#each headingLevels as level (level.id)}
              {@const Icon = icons[level.icon]}
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  class="heading-menu-item"
                  class:active={level.isActive(editorSnapshot())}
                  onclick={() => {
                    runCommand(level);
                    closeMenus();
                  }}
                >
                  <Icon class="toolbar-icon" aria-hidden="true" />
                  <span>{t(level.labelKey)} ({formatShortcut(level.shortcut ?? "")})</span>
                </button>
              </li>
            {/each}
            <li role="none">
              <button
                type="button"
                role="menuitem"
                class="heading-menu-item"
                onclick={() => {
                  runCommand(headingClearCommand);
                  closeMenus();
                }}
              >
                <span>{t(headingClearCommand.labelKey)} ({formatShortcut(headingClearCommand.shortcut ?? "")})</span>
              </button>
            </li>
          </ul>
        {/if}
      </div>
    {:else}
      {@const Icon = icons[command.icon]}
      <button
        type="button"
        class="toolbar-btn"
        class:active={command.isActive(editorSnapshot())}
        title={`${t(command.labelKey)}${command.shortcut ? ` (${formatShortcut(command.shortcut)})` : ""}`}
        aria-label={t(command.labelKey)}
        aria-pressed={command.isActive(editorSnapshot())}
        onclick={() => runCommand(command)}
      >
        <Icon class="toolbar-icon" aria-hidden="true" />
      </button>
    {/if}
    {#if command.separatorAfter}
      <div class="toolbar-separator" aria-hidden="true"></div>
    {/if}
  {/each}

  {#if overflowCommands.length > 0}
    <div class="overflow-group">
      <button
        type="button"
        class="toolbar-btn"
        title={t("toolbar.more")}
        aria-label={t("toolbar.more")}
        aria-haspopup="menu"
        aria-expanded={overflowMenuOpen}
        onclick={() => (overflowMenuOpen = !overflowMenuOpen)}
      >
        <Ellipsis class="toolbar-icon" aria-hidden="true" />
      </button>
      {#if overflowMenuOpen}
        <button type="button" class="menu-backdrop" aria-label={t("dialog.cancel")} onclick={closeMenus}
        ></button>
        <ul class="overflow-menu" role="menu">
          {#each overflowCommands as command (command.id)}
            {@const Icon = icons[command.icon]}
            <li role="none">
              <button
                type="button"
                role="menuitem"
                class="heading-menu-item"
                onclick={() => {
                  runCommand(command);
                  closeMenus();
                }}
              >
                <Icon class="toolbar-icon" aria-hidden="true" />
                <span>{t(command.labelKey)}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

<style>
  .format-toolbar {
    display: flex;
    align-items: center;
    height: 100%;
    gap: var(--space-1);
    padding: 0 var(--space-2);
    overflow: hidden;
  }

  .toolbar-btn {
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

  .toolbar-btn:hover {
    background: var(--c-bg-hover);
  }

  .toolbar-btn.active {
    color: var(--c-accent);
    background: var(--c-accent-soft);
  }

  .toolbar-btn:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  .toolbar-separator {
    width: var(--border-w);
    height: var(--space-4);
    flex-shrink: 0;
    margin: 0 var(--space-1);
    background: var(--c-border);
  }

  .heading-group,
  .overflow-group {
    position: relative;
    display: flex;
    flex-shrink: 0;
  }

  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-popover);
    border: none;
    background: transparent;
    cursor: default;
  }

  .heading-menu,
  .overflow-menu {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: calc(var(--z-popover) + 1);
    margin: var(--space-1) 0 0;
    padding: var(--space-1) 0;
    list-style: none;
    background: var(--c-bg-elev);
    border: var(--border-w) solid var(--c-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-popover);
    white-space: nowrap;
  }

  .heading-menu-item {
    display: flex;
    width: 100%;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: none;
    background: transparent;
    color: var(--c-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .heading-menu-item:hover {
    background: var(--c-bg-hover);
  }

  .heading-menu-item.active {
    color: var(--c-accent);
  }

  :global(.toolbar-icon) {
    width: var(--icon-size);
    height: var(--icon-size);
  }
</style>
