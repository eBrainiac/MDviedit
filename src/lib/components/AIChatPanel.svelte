<script lang="ts">
  import Send from "@lucide/svelte/icons/send";
  import { message } from "@tauri-apps/plugin-dialog";
  import { tabsStore } from "../stores/tabs.svelte";
  import { preferences } from "../stores/preferences.svelte";
  import { aiChatStore } from "../stores/ai-chat.svelte";
  import { aiModelStore } from "../stores/ai-model.svelte";
  import { appConfig, type AiBackend } from "../../config/app.config";
  import { t } from "../../i18n";

  let inputText = $state("");
  let historyEl: HTMLDivElement | undefined = $state();

  const fileTabs = $derived(tabsStore.tabs.filter((tab) => tab.kind === "file"));

  const backends: readonly { value: AiBackend; labelKey: string }[] = [
    { value: "byok", labelKey: "aiChat.backendByok" },
    { value: "local", labelKey: "aiChat.backendLocal" },
  ];

  const contextLimit = $derived(
    aiChatStore.backend === "local" ? appConfig.behavior.aiLocalContextTokens : preferences.aiByokContextTokens,
  );

  // UI-SCREENS §10: aviso cuando el backend elegido no tiene con qué
  // funcionar todavía (sin proveedor BYOK, o modelo local desactivado).
  const needsConfiguration = $derived(
    aiChatStore.backend === "byok" ? preferences.aiProvider === "none" : !preferences.aiUseLocalModel,
  );

  const canSend = $derived(!aiChatStore.sending && inputText.trim().length > 0);

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  async function submit(): Promise<void> {
    if (!canSend) return;
    const text = inputText;
    inputText = "";
    await aiChatStore.sendMessage(text);
  }

  $effect(() => {
    void aiChatStore.entries.length;
    historyEl?.scrollTo({ top: historyEl.scrollHeight });
  });

  // AT-095/UI-SCREENS §10: diálogo "Descarga de modelo fallida" con opción
  // de reintentar — comparación contra la etiqueta REAL del botón elegido
  // (nunca un literal fijo, mismo criterio que recent-files-open.ts/BUG-02).
  let lastHandledError: string | null = null;
  $effect(() => {
    if (aiModelStore.phase !== "error" || !aiModelStore.error) return;
    if (aiModelStore.error === lastHandledError) return;
    lastHandledError = aiModelStore.error;
    void handleDownloadFailure(aiModelStore.error);
  });

  async function handleDownloadFailure(errorMessage: string): Promise<void> {
    const retryLabel = t("dialog.retry");
    try {
      const choice = await message(t("dialog.aiModelDownloadFailedMessage", { error: errorMessage }), {
        title: t("dialog.aiModelDownloadFailedTitle"),
        kind: "error",
        buttons: { ok: retryLabel, cancel: t("dialog.cancel") },
      });
      if (choice === retryLabel) void aiModelStore.ensureLoaded();
    } catch {
      // Fuera de un contexto Tauri real (p. ej. verificación en Chrome
      // durante desarrollo) `message()` lanza de forma síncrona — mismo
      // caso que el aviso de Dock en +layout.svelte; no debe interrumpir
      // el resto de la app ni dejar una excepción sin capturar.
    }
  }
</script>

<!-- SPEC-CORE-022 / UI-SCREENS §10: panel lateral acoplable, convive con el
     editor visible (ver ContentArea.svelte). Ancho fijo vía --aichat-panel-w
     (sin ancho exacto documentado, ver tokens.css). -->
<div class="ai-chat-panel" aria-label={t("aiChat.panelLabel")}>
  <div class="ai-chat-toolbar">
    <div class="segmented" role="group" aria-label={t("aiChat.backendLabel")}>
      {#each backends as option (option.value)}
        <button
          type="button"
          class="segmented-btn"
          class:active={aiChatStore.backend === option.value}
          aria-pressed={aiChatStore.backend === option.value}
          onclick={() => (aiChatStore.backend = option.value)}
        >
          {t(option.labelKey)}
        </button>
      {/each}
    </div>
  </div>

  {#if aiChatStore.backend === "local"}
    <!-- SPEC-CORE-022 (enmienda) / PD-93 / BUG-12: switch dedicado, apagado
         por default — segundo gate aparte de `aiChatEnabled` (AppShell.svelte)
         antes de que se ofrezca la descarga del modelo local (AT-095/119). -->
    <label class="ai-chat-local-switch">
      <span class="pref-label">{t("aiChat.useLocalModelSwitch")}</span>
      <input
        type="checkbox"
        class="switch"
        checked={preferences.aiUseLocalModel}
        onchange={(event) => preferences.setAiUseLocalModel(event.currentTarget.checked)}
      />
    </label>
  {/if}

  {#if fileTabs.length > 0}
    <div class="ai-chat-context" role="group" aria-label={t("aiChat.contextLabel")}>
      {#each fileTabs as tab (tab.id)}
        <label class="context-item">
          <input
            type="checkbox"
            checked={aiChatStore.contextTabIds.has(tab.id)}
            onchange={() => aiChatStore.toggleContextTab(tab.id)}
          />
          <span>{tab.title}</span>
        </label>
      {/each}
    </div>
  {/if}

  <div class="ai-chat-history" bind:this={historyEl}>
    {#if aiChatStore.entries.length === 0}
      <p class="ai-chat-empty">{t("aiChat.emptyHistory")}</p>
    {/if}

    {#each aiChatStore.entries as entry (entry.id)}
      <div class="ai-chat-entry" class:user={entry.role === "user"}>
        <p>{entry.text}</p>
      </div>
    {/each}

    {#if aiChatStore.pendingDiff}
      <div class="ai-chat-diff">
        <h3 class="diff-title">{t("aiChat.proposedChangeTitle")}</h3>
        <div class="diff-body">
          {#each aiChatStore.diffLinesForPending() as line, index (index)}
            <div class="diff-line diff-{line.kind}">{line.text || " "}</div>
          {/each}
        </div>
        <div class="diff-actions">
          <button type="button" class="diff-apply" onclick={() => aiChatStore.applyPendingDiff()}>
            {t("aiChat.applyChange")}
          </button>
          <button type="button" class="diff-discard" onclick={() => aiChatStore.discardPendingDiff()}>
            {t("aiChat.discardChange")}
          </button>
        </div>
      </div>
    {/if}

    {#if aiModelStore.phase === "downloading" && aiModelStore.progress}
      <div class="ai-chat-download">
        <p>{t("aiChat.downloadingModel")}</p>
        <progress class="download-progress" value={aiModelStore.progress.fraction} max="1"></progress>
        <button type="button" class="download-cancel" onclick={() => aiModelStore.cancelDownload()}>
          {t("aiChat.cancelDownload")}
        </button>
      </div>
    {/if}

    {#if aiChatStore.error}
      <p class="ai-chat-error" role="alert">{aiChatStore.error}</p>
    {/if}
  </div>

  {#if needsConfiguration}
    <p class="ai-chat-notice">{t("aiChat.needsConfiguration")}</p>
  {/if}

  <div class="ai-chat-input-row">
    <textarea
      class="ai-chat-input"
      placeholder={t("aiChat.inputPlaceholder")}
      bind:value={inputText}
      onkeydown={handleKeydown}
      disabled={aiChatStore.sending}
    ></textarea>
    <button
      type="button"
      class="ai-chat-send"
      disabled={!canSend}
      aria-label={t("aiChat.send")}
      onclick={submit}
    >
      <Send class="ai-chat-send-icon" aria-hidden="true" />
    </button>
  </div>
  <button
    type="button"
    class="ai-chat-summarize"
    disabled={aiChatStore.sending}
    onclick={() => aiChatStore.summarizeContext(contextLimit)}
  >
    {t("aiChat.summarize")}
  </button>
</div>

<style>
  .ai-chat-panel {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: var(--aichat-panel-w);
    flex-shrink: 0;
    height: 100%;
    border-left: var(--border-w) solid var(--c-border);
    background: var(--c-bg);
    overflow: hidden;
  }

  .ai-chat-toolbar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    padding: var(--space-2);
    border-bottom: var(--border-w) solid var(--c-border);
  }

  .segmented {
    display: flex;
    flex: 1;
    border: var(--border-w) solid var(--c-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .segmented-btn {
    flex: 1;
    height: var(--btn-size);
    padding: 0 var(--space-2);
    border: none;
    border-left: var(--border-w) solid var(--c-border);
    background: transparent;
    color: var(--c-text-muted);
    font: inherit;
    font-size: var(--fs-status);
    cursor: pointer;
  }

  .segmented-btn:first-child {
    border-left: none;
  }

  .segmented-btn.active {
    background: var(--c-accent);
    color: var(--c-accent-contrast);
  }

  .segmented-btn:focus-visible {
    outline: var(--focus-ring);
    outline-offset: calc(var(--focus-ring-offset) * -1);
  }

  .ai-chat-local-switch {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-2);
    border-bottom: var(--border-w) solid var(--c-border);
    cursor: pointer;
  }

  .ai-chat-local-switch .pref-label {
    color: var(--c-text);
    font-size: var(--fs-status);
  }

  .ai-chat-local-switch .switch {
    flex-shrink: 0;
    width: var(--space-8);
    height: var(--btn-size);
    accent-color: var(--c-accent);
    cursor: pointer;
  }

  .ai-chat-context {
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-2);
    border-bottom: var(--border-w) solid var(--c-border);
    max-height: calc(var(--btn-size) * 3);
    overflow-y: auto;
  }

  .context-item {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--c-text);
    font-size: var(--fs-status);
    cursor: pointer;
  }

  .ai-chat-history {
    flex: 1;
    min-height: 0;
    padding: var(--space-2);
    overflow-y: auto;
  }

  .ai-chat-empty {
    color: var(--c-text-muted);
    font-size: var(--fs-status);
  }

  .ai-chat-entry {
    margin-bottom: var(--space-2);
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--c-bg-elev);
    font-size: var(--fs-ui);
  }

  .ai-chat-entry p {
    margin: 0;
    white-space: pre-wrap;
  }

  .ai-chat-entry.user {
    background: var(--c-accent-soft);
  }

  .ai-chat-diff {
    margin-bottom: var(--space-2);
    padding: var(--space-2);
    border: var(--border-w) solid var(--c-border);
    border-radius: var(--radius-sm);
  }

  .diff-title {
    margin: 0 0 var(--space-2);
    font-size: var(--fs-status);
    font-weight: 600;
  }

  .diff-body {
    max-height: calc(var(--btn-size) * 6);
    overflow-y: auto;
    border-radius: var(--radius-sm);
    background: var(--c-code-bg);
    font-family: var(--font-mono);
    font-size: var(--fs-status);
  }

  .diff-line {
    padding: 0 var(--space-2);
    white-space: pre-wrap;
  }

  .diff-added {
    background: color-mix(in srgb, var(--c-accent) 20%, transparent);
  }

  .diff-removed {
    background: color-mix(in srgb, var(--c-danger) 20%, transparent);
    text-decoration: line-through;
  }

  .diff-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .diff-apply,
  .diff-discard {
    height: var(--btn-size);
    padding: 0 var(--space-3);
    border: var(--border-w) solid var(--c-border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--c-text);
    font: inherit;
    cursor: pointer;
  }

  .diff-apply {
    border-color: var(--c-accent);
    color: var(--c-accent);
  }

  .diff-apply:focus-visible,
  .diff-discard:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  .ai-chat-download {
    margin-bottom: var(--space-2);
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--c-bg-elev);
    font-size: var(--fs-status);
  }

  .download-progress {
    width: 100%;
    margin: var(--space-2) 0;
    accent-color: var(--c-accent);
  }

  .download-cancel {
    height: var(--btn-size);
    padding: 0 var(--space-3);
    border: var(--border-w) solid var(--c-border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--c-text);
    font: inherit;
    cursor: pointer;
  }

  .ai-chat-error {
    color: var(--c-danger);
    font-size: var(--fs-status);
  }

  .ai-chat-notice {
    flex-shrink: 0;
    margin: 0;
    padding: var(--space-2);
    color: var(--c-text-muted);
    font-size: var(--fs-status);
    border-top: var(--border-w) solid var(--c-border);
  }

  .ai-chat-input-row {
    display: flex;
    flex-shrink: 0;
    align-items: flex-end;
    gap: var(--space-2);
    padding: var(--space-2);
    border-top: var(--border-w) solid var(--c-border);
  }

  .ai-chat-input {
    flex: 1;
    min-height: calc(var(--btn-size) * 2);
    max-height: calc(var(--btn-size) * 5);
    padding: var(--space-2);
    border: var(--border-w) solid var(--c-border);
    border-radius: var(--radius-sm);
    background: var(--c-bg);
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-ui);
    resize: vertical;
  }

  .ai-chat-input:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  .ai-chat-send {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: var(--btn-size);
    height: var(--btn-size);
    border: none;
    border-radius: var(--radius-sm);
    background: var(--c-accent);
    color: var(--c-accent-contrast);
    cursor: pointer;
  }

  .ai-chat-send:disabled {
    background: var(--c-bg-elev);
    color: var(--c-text-muted);
    cursor: default;
  }

  .ai-chat-send:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  :global(.ai-chat-send-icon) {
    width: var(--icon-size);
    height: var(--icon-size);
  }

  .ai-chat-summarize {
    flex-shrink: 0;
    margin: 0 var(--space-2) var(--space-2);
    height: var(--btn-size);
    padding: 0 var(--space-3);
    border: var(--border-w) solid var(--c-border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-status);
    cursor: pointer;
  }

  .ai-chat-summarize:disabled {
    color: var(--c-text-muted);
    cursor: default;
  }

  .ai-chat-summarize:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }
</style>
