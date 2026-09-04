<script lang="ts">
  import { tabsStore } from "../stores/tabs.svelte";
  import { t } from "../../i18n";

  let { tabId }: { tabId: string } = $props();
</script>

<!-- UI-SCREENS §3 / NFR-005 / PD-43. -->
<div class="large-file-notice" role="status">
  <span>{t("largeFile.notice")}</span>
  <button type="button" onclick={() => tabsStore.openLargeFileAnyway(tabId)}>
    {t("largeFile.openAnyway")}
  </button>
</div>

<style>
  .large-file-notice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--c-bg-elev);
    border-bottom: var(--border-w) solid var(--c-border);
    color: var(--c-text-muted);
    font-size: var(--fs-status);
  }

  button {
    flex-shrink: 0;
    height: var(--btn-size);
    padding: 0 var(--space-3);
    border: var(--border-w) solid var(--c-border);
    border-radius: var(--radius-sm);
    background: var(--c-bg);
    color: var(--c-text);
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    background: var(--c-bg-hover);
  }
</style>
