<script lang="ts">
  import { appConfig } from "../../config/app.config";
  import { tabsStore } from "../stores/tabs.svelte";
  import { t } from "../../i18n";

  const activeTab = $derived(tabsStore.active);
  // TAB-031 / SPEC-CORE-009: sin pestañas o en Preferencias no hay dirty/saved.
  const showState = $derived(activeTab?.kind === "file");
</script>

<div class="status-bar">
  <span class="app-name">{appConfig.name}</span>
  <span class="spacer" aria-hidden="true"></span>
  {#if showState}
    {#if activeTab?.dirty}
      <span class="dirty">{t("statusBar.dirty")}</span>
    {:else}
      <span class="saved">{t("statusBar.saved")}</span>
    {/if}
  {/if}
</div>

<style>
  .status-bar {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    height: var(--statusbar-h);
    padding: 0 var(--space-3);
    background: var(--c-bg-elev);
    border-top: var(--border-w) solid var(--c-border);
    font-size: var(--fs-status);
    color: var(--c-text-muted);
  }

  .spacer {
    flex: 1;
  }

  .dirty {
    color: var(--c-dirty);
  }
</style>
