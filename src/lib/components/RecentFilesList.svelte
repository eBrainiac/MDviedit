<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import { recentFilesStore } from "../stores/recent-files.svelte";
  import { openRecentFile } from "../stores/recent-files-open";
  import { preferences } from "../stores/preferences.svelte";
  import { t } from "../../i18n";
  import { formatRelativeTime } from "../relative-time";

  let { onNavigate }: { onNavigate?: () => void } = $props();

  const items = $derived(recentFilesStore.visible(preferences.recentFilesLimit));

  function dirnameOf(path: string): string {
    const normalized = path.replaceAll("\\", "/");
    return normalized.slice(0, normalized.lastIndexOf("/"));
  }

  async function handleClick(entry: (typeof items)[number]): Promise<void> {
    const opened = await openRecentFile(entry);
    if (opened) onNavigate?.();
  }

  function removeEntry(event: MouseEvent, path: string): void {
    event.stopPropagation();
    recentFilesStore.remove(path);
  }
</script>

{#if items.length > 0}
  <div class="recent-files">
    <ul class="recent-list">
      {#each items as entry (entry.path)}
        <li class="recent-item">
          <button type="button" class="recent-entry" title={entry.path} onclick={() => handleClick(entry)}>
            <span class="recent-info">
              <span class="recent-name">{entry.title}</span>
              <span class="recent-folder">{dirnameOf(entry.path)}</span>
            </span>
            <span class="recent-time">{formatRelativeTime(entry.lastAccessedAt)}</span>
          </button>
          <button
            type="button"
            class="recent-remove"
            aria-label={t("recentFiles.remove")}
            title={t("recentFiles.remove")}
            onclick={(event) => removeEntry(event, entry.path)}
          >
            <X class="recent-remove-icon" aria-hidden="true" />
          </button>
        </li>
      {/each}
    </ul>
    <button type="button" class="recent-clear" onclick={() => recentFilesStore.clear()}>
      {t("recentFiles.clear")}
    </button>
  </div>
{/if}

<style>
  .recent-files {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: var(--space-2);
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .recent-item {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .recent-entry {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-2);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--c-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .recent-entry:hover {
    background: var(--c-bg-hover);
  }

  .recent-entry:focus-visible {
    outline: var(--focus-ring);
    outline-offset: calc(var(--focus-ring-offset) * -1);
  }

  .recent-info {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
  }

  .recent-name {
    overflow: hidden;
    max-width: 100%;
    color: var(--c-text);
    font-size: var(--fs-ui);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recent-folder {
    overflow: hidden;
    max-width: 100%;
    color: var(--c-text-muted);
    font-size: var(--fs-status);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recent-time {
    flex-shrink: 0;
    color: var(--c-text-muted);
    font-size: var(--fs-status);
    white-space: nowrap;
  }

  .recent-remove {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: var(--btn-size);
    height: var(--btn-size);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--c-text-muted);
    cursor: pointer;
  }

  .recent-remove:hover {
    background: var(--c-bg-hover);
    color: var(--c-text);
  }

  .recent-remove:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  :global(.recent-remove-icon) {
    width: var(--icon-size);
    height: var(--icon-size);
  }

  .recent-clear {
    align-self: center;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--c-accent);
    font: inherit;
    font-size: var(--fs-status);
    cursor: pointer;
  }

  .recent-clear:hover {
    text-decoration: underline;
  }

  .recent-clear:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }
</style>
