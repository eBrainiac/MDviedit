<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import { preferences } from "../stores/preferences.svelte";
  import { t } from "../../i18n";

  let { disabled = false }: { disabled?: boolean } = $props();
</script>

<!-- SPEC-CORE-022 / UI-SCREENS línea 32: extremo derecho, junto a
     ViewToggle. aiChatEnabled es el estado único: activar/desactivar aquí
     equivale al switch maestro de Preferencias → IA (mismo patrón dual que
     FormatToggle/formatToolbarVisible). -->
<button
  type="button"
  class="ai-chat-toggle"
  class:active={preferences.aiChatEnabled}
  {disabled}
  aria-pressed={preferences.aiChatEnabled}
  aria-label={t("topRow.aiChatToggle")}
  title={t("topRow.aiChatToggle")}
  onclick={() => preferences.setAiChatEnabled(!preferences.aiChatEnabled)}
>
  <Bot class="ai-chat-toggle-icon" aria-hidden="true" />
</button>

<style>
  .ai-chat-toggle {
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

  .ai-chat-toggle.active {
    color: var(--c-accent);
    background: var(--c-accent-soft);
  }

  .ai-chat-toggle:disabled {
    color: var(--c-text-muted);
    cursor: default;
    opacity: 0.5;
  }

  .ai-chat-toggle:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  .ai-chat-toggle:hover:not(:disabled) {
    background: var(--c-bg-hover);
  }

  :global(.ai-chat-toggle-icon) {
    width: var(--icon-size);
    height: var(--icon-size);
  }
</style>
