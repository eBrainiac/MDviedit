<script lang="ts">
  import Minus from "@lucide/svelte/icons/minus";
  import Plus from "@lucide/svelte/icons/plus";
  import { invoke } from "@tauri-apps/api/core";
  import { message } from "@tauri-apps/plugin-dialog";
  import { preferences } from "../stores/preferences.svelte";
  import {
    appConfig,
    type DockPosition,
    type PalKey,
    type ThemeMode,
    type ViewMode,
    type Locale,
  } from "../../config/app.config";
  import { isMacPlatform } from "../shortcut-match";
  import { t } from "../../i18n";

  const isMac = isMacPlatform();

  const themeModes: readonly { value: ThemeMode; labelKey: string }[] = [
    { value: "system", labelKey: "preferences.themeModeSystem" },
    { value: "light", labelKey: "preferences.themeModeLight" },
    { value: "dark", labelKey: "preferences.themeModeDark" },
  ];

  const palettes: readonly { value: PalKey; labelKey: string }[] = [
    { value: "a", labelKey: "preferences.paletteA" },
    { value: "b", labelKey: "preferences.paletteB" },
    { value: "c", labelKey: "preferences.paletteC" },
  ];

  const dockPositions: readonly { value: DockPosition; labelKey: string }[] = [
    { value: "right", labelKey: "preferences.dockPositionRight" },
    { value: "left", labelKey: "preferences.dockPositionLeft" },
    { value: "top", labelKey: "preferences.dockPositionTop" },
    { value: "bottom", labelKey: "preferences.dockPositionBottom" },
  ];

  const viewModes: readonly { value: ViewMode; labelKey: string }[] = [
    { value: "formatted", labelKey: "topRow.viewToggleFormatted" },
    { value: "raw", labelKey: "topRow.viewToggleRaw" },
  ];

  const locales: readonly { value: Locale; labelKey: string }[] = [
    { value: "es-MX", labelKey: "preferences.localeEsMx" },
    { value: "en", labelKey: "preferences.localeEn" },
  ];

  function zoomStep(delta: number): void {
    preferences.setEditorFontSize(preferences.editorFontSize + delta);
  }

  async function handleInstallPathCommand(): Promise<void> {
    try {
      await invoke("install_path_command");
    } catch (fallbackCommand) {
      await message(`${t("dialog.installPathCommandFailed")}\n\n${String(fallbackCommand)}`, {
        title: t("preferences.tabTitle"),
        kind: "error",
      });
    }
  }
</script>

<div class="preferences-view">
  <section class="pref-section">
    <h2 class="pref-heading">{t("preferences.sectionAppearance")}</h2>

    <div class="pref-row">
      <span class="pref-label" id="pref-theme-label">{t("preferences.themeMode")}</span>
      <div class="segmented" role="group" aria-labelledby="pref-theme-label">
        {#each themeModes as option (option.value)}
          <button
            type="button"
            class="segmented-btn"
            class:active={preferences.themeMode === option.value}
            aria-pressed={preferences.themeMode === option.value}
            onclick={() => preferences.setThemeMode(option.value)}
          >
            {t(option.labelKey)}
          </button>
        {/each}
      </div>
    </div>

    <div class="pref-row">
      <span class="pref-label" id="pref-palette-label">{t("preferences.paletteLabel")}</span>
      <div class="palette-group" role="group" aria-labelledby="pref-palette-label">
        {#each palettes as option (option.value)}
          <button
            type="button"
            class="palette-card"
            class:active={preferences.palette === option.value}
            aria-pressed={preferences.palette === option.value}
            onclick={() => preferences.setPalette(option.value)}
          >
            <span class="palette-swatch" data-palette-preview={option.value} data-theme={preferences.resolvedTheme}
            ></span>
            <span class="palette-name">{t(option.labelKey)}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="pref-row">
      <span class="pref-label" id="pref-fontsize-label">{t("preferences.editorFontSize")}</span>
      <div class="stepper" role="group" aria-labelledby="pref-fontsize-label">
        <button
          type="button"
          class="stepper-btn"
          disabled={preferences.editorFontSize <= appConfig.behavior.editorFontSizeMin}
          aria-label={t("preferences.editorFontSizeDecrease")}
          onclick={() => zoomStep(-appConfig.behavior.editorFontSizeStep)}
        >
          <Minus class="stepper-icon" aria-hidden="true" />
        </button>
        <output class="stepper-value">{preferences.editorFontSize}</output>
        <button
          type="button"
          class="stepper-btn"
          disabled={preferences.editorFontSize >= appConfig.behavior.editorFontSizeMax}
          aria-label={t("preferences.editorFontSizeIncrease")}
          onclick={() => zoomStep(appConfig.behavior.editorFontSizeStep)}
        >
          <Plus class="stepper-icon" aria-hidden="true" />
        </button>
      </div>
    </div>
  </section>

  <section class="pref-section">
    <h2 class="pref-heading">{t("preferences.sectionLayout")}</h2>

    <div class="pref-row">
      <span class="pref-label" id="pref-dock-label">{t("preferences.dockPosition")}</span>
      <div class="segmented" role="group" aria-labelledby="pref-dock-label">
        {#each dockPositions as option (option.value)}
          <button
            type="button"
            class="segmented-btn"
            class:active={preferences.dockPosition === option.value}
            aria-pressed={preferences.dockPosition === option.value}
            onclick={() => preferences.setDockPosition(option.value)}
          >
            {t(option.labelKey)}
          </button>
        {/each}
      </div>
    </div>

    <label class="pref-row pref-row-switch">
      <span class="pref-label">{t("preferences.formatToolbarVisible")}</span>
      <input
        type="checkbox"
        class="switch"
        checked={preferences.formatToolbarVisible}
        onchange={(event) => preferences.setFormatToolbarVisible(event.currentTarget.checked)}
      />
    </label>
  </section>

  <section class="pref-section">
    <h2 class="pref-heading">{t("preferences.sectionEditor")}</h2>

    <label class="pref-row pref-row-switch">
      <span class="pref-label">{t("preferences.lineNumbers")}</span>
      <input
        type="checkbox"
        class="switch"
        checked={preferences.lineNumbers}
        onchange={(event) => preferences.setLineNumbers(event.currentTarget.checked)}
      />
    </label>

    <div class="pref-row">
      <span class="pref-label" id="pref-viewmode-label">{t("preferences.defaultViewMode")}</span>
      <div class="segmented" role="group" aria-labelledby="pref-viewmode-label">
        {#each viewModes as option (option.value)}
          <button
            type="button"
            class="segmented-btn"
            class:active={preferences.defaultViewMode === option.value}
            aria-pressed={preferences.defaultViewMode === option.value}
            onclick={() => preferences.setDefaultViewMode(option.value)}
          >
            {t(option.labelKey)}
          </button>
        {/each}
      </div>
    </div>
  </section>

  <section class="pref-section">
    <h2 class="pref-heading">{t("preferences.sectionFiles")}</h2>

    <label class="pref-row pref-row-switch">
      <span class="pref-label">{t("preferences.watchFiles")}</span>
      <input
        type="checkbox"
        class="switch"
        checked={preferences.watchFiles}
        onchange={(event) => preferences.setWatchFiles(event.currentTarget.checked)}
      />
    </label>
  </section>

  {#if isMac}
    <section class="pref-section">
      <h2 class="pref-heading">{t("preferences.sectionSystem")}</h2>

      <div class="pref-row">
        <button type="button" class="pref-action-btn" onclick={handleInstallPathCommand}>
          {t("preferences.installPathCommand")}
        </button>
      </div>

      <div class="pref-row">
        <button type="button" class="pref-action-btn" onclick={() => preferences.setDockPromptDismissed(false)}>
          {t("preferences.showDockPromptAgain")}
        </button>
      </div>
    </section>
  {/if}

  <section class="pref-section">
    <h2 class="pref-heading">{t("preferences.sectionGeneral")}</h2>

    <div class="pref-row">
      <span class="pref-label" id="pref-locale-label">{t("preferences.locale")}</span>
      <div class="segmented" role="group" aria-labelledby="pref-locale-label">
        {#each locales as option (option.value)}
          <button
            type="button"
            class="segmented-btn"
            class:active={preferences.locale === option.value}
            aria-pressed={preferences.locale === option.value}
            onclick={() => preferences.setLocale(option.value)}
          >
            {t(option.labelKey)}
          </button>
        {/each}
      </div>
    </div>
  </section>

  <div class="pref-footer">
    <button type="button" class="pref-reset-btn" onclick={() => preferences.resetToDefaults()}>
      {t("preferences.reset")}
    </button>
  </div>
</div>

<style>
  .preferences-view {
    box-sizing: border-box;
    height: 100%;
    max-width: var(--prefs-max-w);
    margin: 0 auto;
    padding: var(--space-4) var(--space-4) var(--space-8);
    overflow-y: auto;
  }

  .pref-section {
    margin-bottom: var(--space-6);
  }

  .pref-heading {
    margin: 0 0 var(--space-3);
    color: var(--c-text);
    font-size: var(--fs-ui);
    font-weight: 600;
  }

  .pref-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-2) 0;
    cursor: default;
  }

  .pref-row-switch {
    cursor: pointer;
  }

  .pref-label {
    color: var(--c-text);
    font-size: var(--fs-ui);
  }

  .segmented {
    display: flex;
    flex-shrink: 0;
    border: var(--border-w) solid var(--c-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .segmented-btn {
    height: var(--btn-size);
    padding: 0 var(--space-3);
    border: none;
    border-left: var(--border-w) solid var(--c-border);
    background: transparent;
    color: var(--c-text-muted);
    font: inherit;
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

  .segmented-btn:hover:not(.active) {
    background: var(--c-bg-hover);
  }

  .palette-group {
    display: flex;
    flex-shrink: 0;
    gap: var(--space-2);
  }

  .palette-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2);
    border: var(--border-w) solid var(--c-border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--c-text-muted);
    font: inherit;
    cursor: pointer;
  }

  .palette-card.active {
    border-color: var(--c-accent);
    color: var(--c-text);
  }

  .palette-card:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  .palette-swatch {
    display: block;
    width: var(--btn-size);
    height: var(--btn-size);
    border-radius: var(--radius-sm);
    background: var(--c-accent);
  }

  .palette-name {
    font-size: var(--fs-ui);
    white-space: nowrap;
  }

  .stepper {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: var(--space-2);
  }

  .stepper-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--btn-size);
    height: var(--btn-size);
    border: var(--border-w) solid var(--c-border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--c-text);
    cursor: pointer;
  }

  .stepper-btn:disabled {
    color: var(--c-text-muted);
    cursor: default;
    opacity: 0.5;
  }

  .stepper-btn:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  .stepper-btn:hover:not(:disabled) {
    background: var(--c-bg-hover);
  }

  .stepper-value {
    min-width: var(--space-8);
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  :global(.stepper-icon) {
    width: var(--icon-size);
    height: var(--icon-size);
  }

  .switch {
    flex-shrink: 0;
    width: var(--space-8);
    height: var(--btn-size);
    accent-color: var(--c-accent);
    cursor: pointer;
  }

  .pref-action-btn,
  .pref-reset-btn {
    height: var(--btn-size);
    padding: 0 var(--space-4);
    border: var(--border-w) solid var(--c-border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--c-text);
    font: inherit;
    cursor: pointer;
  }

  .pref-reset-btn {
    color: var(--c-danger);
  }

  .pref-action-btn:focus-visible,
  .pref-reset-btn:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  .pref-action-btn:hover,
  .pref-reset-btn:hover {
    background: var(--c-bg-hover);
  }

  .pref-footer {
    display: flex;
    justify-content: center;
    padding-top: var(--space-4);
    border-top: var(--border-w) solid var(--c-border);
  }
</style>
