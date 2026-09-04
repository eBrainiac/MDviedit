<script lang="ts">
  import Type from "@lucide/svelte/icons/type";
  import { preferences } from "../stores/preferences.svelte";
  import { appConfig } from "../../config/app.config";
  import { formatShortcut } from "../format-shortcut";
  import { t } from "../../i18n";

  let { disabled = false }: { disabled?: boolean } = $props();
</script>

<!-- SPEC-CORE-005 / PD-05: icono "Aa" (Lucide `type`), extremo izquierdo. -->
<button
  type="button"
  class="format-toggle"
  class:active={preferences.formatToolbarVisible}
  {disabled}
  aria-pressed={preferences.formatToolbarVisible}
  aria-label={t("topRow.formatToggle")}
  title={`${t("topRow.formatToggle")} (${formatShortcut(appConfig.shortcuts.toggleFormatToolbar)})`}
  onclick={() => preferences.toggleFormatToolbarVisible()}
>
  <Type class="format-toggle-icon" aria-hidden="true" />
</button>

<style>
  .format-toggle {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: var(--btn-size);
    height: var(--btn-size);
    margin: 0 var(--space-1);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--c-text);
    cursor: pointer;
  }

  .format-toggle.active {
    color: var(--c-accent);
    background: var(--c-accent-soft);
  }

  .format-toggle:disabled {
    color: var(--c-text-muted);
    cursor: default;
    opacity: 0.5;
  }

  .format-toggle:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  .format-toggle:hover:not(:disabled) {
    background: var(--c-bg-hover);
  }

  :global(.format-toggle-icon) {
    width: var(--icon-size);
    height: var(--icon-size);
  }
</style>
