<script lang="ts">
  import FilePlus from "@lucide/svelte/icons/file-plus";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import { appConfig } from "../../config/app.config";
  import { tabsStore } from "../stores/tabs.svelte";
  import { t } from "../../i18n";
</script>

<!-- UI-SCREENS §1, estado `empty` -->
<div class="empty-state">
  <p class="app-name">{appConfig.name}</p>
  <p class="hint">{t("emptyState.text")}</p>
  <div class="actions">
    <button type="button" class="action" onclick={() => tabsStore.newTab()}>
      <FilePlus class="icon" aria-hidden="true" />
      {t("dock.new")}
    </button>
    <button type="button" class="action" onclick={() => tabsStore.openDialog()}>
      <FolderOpen class="icon" aria-hidden="true" />
      {t("dock.open")}
    </button>
  </div>
</div>

<style>
  .empty-state {
    display: flex;
    height: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    color: var(--c-text-muted);
  }

  .app-name {
    margin: 0;
    color: var(--c-text);
    font-size: var(--fs-content);
  }

  .hint {
    margin: 0;
  }

  .actions {
    display: flex;
    gap: var(--space-2);
  }

  .action {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    height: var(--btn-size);
    padding: 0 var(--space-3);
    border: var(--border-w) solid var(--c-border);
    border-radius: var(--radius-sm);
    background: var(--c-bg-elev);
    color: var(--c-text);
    font: inherit;
    cursor: pointer;
  }

  .action:hover {
    background: var(--c-bg-hover);
  }

  .action:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  :global(.empty-state .icon) {
    width: var(--icon-size);
    height: var(--icon-size);
  }
</style>
