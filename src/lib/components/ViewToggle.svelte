<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import Code from "@lucide/svelte/icons/code";
  import { tabsStore } from "../stores/tabs.svelte";
  import { appConfig } from "../../config/app.config";
  import { formatShortcut } from "../format-shortcut";
  import { t } from "../../i18n";

  let { disabled = false }: { disabled?: boolean } = $props();

  const activeTab = $derived(tabsStore.active);
  const shortcutLabel = formatShortcut(appConfig.shortcuts.toggleView);
</script>

<!-- SPEC-CORE-003 / PD-06: extremo derecho, actúa sobre la pestaña activa. -->
<div class="view-toggle" role="group" aria-label={t("topRow.viewToggleLabel")}>
  <button
    type="button"
    class="view-toggle-btn"
    class:active={activeTab?.viewMode === "formatted"}
    disabled={disabled || !activeTab}
    title={`${t("topRow.viewToggleFormatted")} (${shortcutLabel})`}
    aria-pressed={activeTab?.viewMode === "formatted"}
    onclick={() => activeTab && tabsStore.setViewMode(activeTab.id, "formatted")}
  >
    <Eye class="view-toggle-icon" aria-hidden="true" />
    <span>{t("topRow.viewToggleFormatted")}</span>
  </button>
  <button
    type="button"
    class="view-toggle-btn"
    class:active={activeTab?.viewMode === "raw"}
    disabled={disabled || !activeTab}
    title={`${t("topRow.viewToggleRaw")} (${shortcutLabel})`}
    aria-pressed={activeTab?.viewMode === "raw"}
    onclick={() => activeTab && tabsStore.setViewMode(activeTab.id, "raw")}
  >
    <Code class="view-toggle-icon" aria-hidden="true" />
    <span>{t("topRow.viewToggleRaw")}</span>
  </button>
</div>

<style>
  .view-toggle {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    margin: 0 var(--space-2);
    border: var(--border-w) solid var(--c-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .view-toggle-btn {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    height: var(--btn-size);
    padding: 0 var(--space-2);
    border: none;
    background: transparent;
    color: var(--c-text-muted);
    font-size: var(--fs-ui);
    cursor: pointer;
  }

  .view-toggle-btn.active {
    color: var(--c-accent-contrast);
    background: var(--c-accent);
  }

  .view-toggle-btn:disabled {
    cursor: default;
    opacity: 0.5;
  }

  .view-toggle-btn:focus-visible {
    outline: var(--focus-ring);
    outline-offset: calc(var(--focus-ring-offset) * -1);
  }

  .view-toggle-btn:hover:not(:disabled) {
    background: var(--c-bg-hover);
  }

  :global(.view-toggle-icon) {
    width: var(--icon-size);
    height: var(--icon-size);
  }
</style>
