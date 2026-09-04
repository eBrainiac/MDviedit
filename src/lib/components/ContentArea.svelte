<script lang="ts">
  import { tabsStore } from "../stores/tabs.svelte";
  import { breakpointStore } from "../stores/breakpoint.svelte";
  import EmptyState from "./EmptyState.svelte";
  import PreferencesView from "./PreferencesView.svelte";
  import RawEditorView from "./RawEditorView.svelte";
  import WysiwygEditorView from "./WysiwygEditorView.svelte";
  import LargeFileNotice from "./LargeFileNotice.svelte";

  const activeTab = $derived(tabsStore.active);

  let rootEl: HTMLDivElement | undefined = $state();

  // UI-LAYOUT-RULES §5: único mecanismo permitido para breakpoints
  // (ADR-012 COORD-005 — nunca window.innerWidth).
  $effect(() => {
    if (!rootEl) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) breakpointStore.contentWidth = entry.contentRect.width;
    });
    observer.observe(rootEl);
    return () => observer.disconnect();
  });
</script>

<div class="content-area" bind:this={rootEl}>
  {#if tabsStore.tabs.length === 0}
    <EmptyState />
  {:else if activeTab?.kind === "preferences"}
    <PreferencesView />
  {:else if activeTab}
    <div class="content-column">
      {#if activeTab.large}
        <LargeFileNotice tabId={activeTab.id} />
      {/if}
      <div class="content-editor">
        {#key activeTab.id + activeTab.viewMode + activeTab.reloadNonce}
          {#if activeTab.viewMode === "formatted"}
            <WysiwygEditorView tab={activeTab} />
          {:else}
            <RawEditorView tab={activeTab} />
          {/if}
        {/key}
      </div>
    </div>
  {/if}
</div>

<style>
  .content-area {
    height: 100%;
    overflow: hidden;
    background: var(--c-bg);
  }

  .content-column {
    display: flex;
    height: 100%;
    flex-direction: column;
  }

  .content-editor {
    flex: 1;
    min-height: 0;
  }
</style>
