<script lang="ts">
  import { slide } from "svelte/transition";
  import { tabsStore } from "../stores/tabs.svelte";
  import { preferences } from "../stores/preferences.svelte";
  import { getDurMedMs } from "../../config/css-tokens";
  import FormatToggle from "./FormatToggle.svelte";
  import FormatToolbar from "./FormatToolbar.svelte";
  import ViewToggle from "./ViewToggle.svelte";

  const activeTab = $derived(tabsStore.active);
  // UI-SCREENS §1/§2: deshabilitada en los estados `empty` y `preferences`.
  const disabled = $derived(!activeTab || activeTab.kind !== "file");
</script>

<!-- SPEC-CORE-003/005 (BL-032/033): FormatToggle a la izquierda, luego el
     FormatToolbar desplegable, espacio flexible, ViewToggle a la derecha. -->
<div class="top-row">
  <FormatToggle {disabled} />
  {#if preferences.formatToolbarVisible && !disabled}
    <div class="toolbar-slot" transition:slide={{ duration: getDurMedMs(), axis: "x" }}>
      <FormatToolbar />
    </div>
  {/if}
  <span class="spacer" aria-hidden="true"></span>
  <ViewToggle {disabled} />
</div>

<style>
  .top-row {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    height: var(--bar-h);
    background: var(--c-bg);
    border-bottom: var(--border-w) solid var(--c-border);
    overflow: hidden;
  }

  .toolbar-slot {
    overflow: hidden;
  }

  .spacer {
    flex: 1;
  }
</style>
