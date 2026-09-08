/**
 * Preferencias (SPEC-CORE-011/018, ADR-006 capa 4). Persistidas vía
 * tauri-plugin-store en `appConfigDir/preferences.json`. Cada campo tiene
 * default y validación en app.config.ts (CFG-004): un valor inválido en
 * disco cae al default, nunca produce un error.
 *
 * En IT-1 solo `themeMode`, `palette` y `dockPosition` tienen UI real
 * (Dock, Preferencias llega en IT-5); el resto se persiste igual para no
 * perder forma del archivo entre iteraciones.
 */
import { Store } from "@tauri-apps/plugin-store";
import {
  appConfig,
  type AiProvider,
  type DockPosition,
  type Locale,
  type PalKey,
  type ThemeMode,
  type ViewMode,
} from "../../config/app.config";
import { setLocale as setI18nLocale } from "../../i18n";

const defaults = appConfig.preferencesDefaults;
const THEME_MODES: readonly ThemeMode[] = ["system", "light", "dark"];
const PALETTES: readonly PalKey[] = ["a", "b", "c"];
const DOCK_POSITIONS: readonly DockPosition[] = ["left", "right", "top", "bottom"];
const VIEW_MODES: readonly ViewMode[] = ["raw", "formatted"];
const LOCALES: readonly Locale[] = ["es-MX", "en"];
const AI_PROVIDERS: readonly AiProvider[] = [
  "none",
  "openai",
  "anthropic",
  "openrouter",
  "nous",
  "together",
  "groq",
  "custom",
];

function isOneOf<T>(values: readonly T[], value: unknown): value is T {
  return (values as readonly unknown[]).includes(value);
}

class PreferencesStore {
  themeMode = $state<ThemeMode>(defaults.themeMode);
  palette = $state<PalKey>(defaults.palette);
  editorFontSize = $state<number>(defaults.editorFontSize);
  dockPosition = $state<DockPosition>(defaults.dockPosition);
  formatToolbarVisible = $state<boolean>(defaults.formatToolbarVisible);
  lineNumbers = $state<boolean>(defaults.lineNumbers);
  defaultViewMode = $state<ViewMode>(defaults.defaultViewMode);
  watchFiles = $state<boolean>(defaults.watchFiles);
  dockPromptDismissed = $state<boolean>(defaults.dockPromptDismissed);
  locale = $state<Locale>(defaults.locale);
  recentFilesLimit = $state<number>(defaults.recentFilesLimit);
  // SPEC-CORE-022 / ADR-010 / PD-65: `aiApiKey` NO vive aquí (desviación
  // explícita de ADR-006, ver ai-keychain.ts) — solo el resto de la config
  // de IA, que no es sensible y sí sigue el patrón normal de preferencias.
  aiChatEnabled = $state<boolean>(defaults.aiChatEnabled);
  aiProvider = $state<AiProvider>(defaults.aiProvider);
  aiBaseUrl = $state<string>(defaults.aiBaseUrl);
  aiModelId = $state<string>(defaults.aiModelId);
  aiByokContextTokens = $state<number>(defaults.aiByokContextTokens);
  aiUseLocalModel = $state<boolean>(defaults.aiUseLocalModel);

  /** Modo resuelto (system -> light/dark real) aplicado a data-theme. */
  resolvedTheme = $state<"light" | "dark">("light");

  #store: Store | null = null;
  #media: MediaQueryList | null = null;
  #ready = false;

  async init(): Promise<void> {
    if (this.#ready) return;
    this.#ready = true;

    this.#store = await Store.load(appConfig.store.preferencesFile);
    await this.#hydrate();

    this.#media = window.matchMedia("(prefers-color-scheme: dark)");
    this.#media.addEventListener("change", this.#onSystemThemeChange);

    this.#applyDom();
  }

  #onSystemThemeChange = (): void => {
    if (this.themeMode === "system") this.#applyDom();
  };

  async #hydrate(): Promise<void> {
    if (!this.#store) return;
    const themeMode = await this.#store.get<ThemeMode>("themeMode");
    const palette = await this.#store.get<PalKey>("palette");
    const editorFontSize = await this.#store.get<number>("editorFontSize");
    const dockPosition = await this.#store.get<DockPosition>("dockPosition");
    const formatToolbarVisible = await this.#store.get<boolean>("formatToolbarVisible");
    const lineNumbers = await this.#store.get<boolean>("lineNumbers");
    const defaultViewMode = await this.#store.get<ViewMode>("defaultViewMode");
    const watchFiles = await this.#store.get<boolean>("watchFiles");
    const dockPromptDismissed = await this.#store.get<boolean>("dockPromptDismissed");
    const locale = await this.#store.get<Locale>("locale");
    const recentFilesLimit = await this.#store.get<number>("recentFilesLimit");
    const aiChatEnabled = await this.#store.get<boolean>("aiChatEnabled");
    const aiProvider = await this.#store.get<AiProvider>("aiProvider");
    const aiBaseUrl = await this.#store.get<string>("aiBaseUrl");
    const aiModelId = await this.#store.get<string>("aiModelId");
    const aiByokContextTokens = await this.#store.get<number>("aiByokContextTokens");
    const aiUseLocalModel = await this.#store.get<boolean>("aiUseLocalModel");

    this.themeMode = isOneOf(THEME_MODES, themeMode) ? themeMode : defaults.themeMode;
    this.palette = isOneOf(PALETTES, palette) ? palette : defaults.palette;
    this.editorFontSize =
      typeof editorFontSize === "number" &&
      editorFontSize >= appConfig.behavior.editorFontSizeMin &&
      editorFontSize <= appConfig.behavior.editorFontSizeMax
        ? editorFontSize
        : defaults.editorFontSize;
    this.dockPosition = isOneOf(DOCK_POSITIONS, dockPosition) ? dockPosition : defaults.dockPosition;
    this.formatToolbarVisible =
      typeof formatToolbarVisible === "boolean" ? formatToolbarVisible : defaults.formatToolbarVisible;
    this.lineNumbers = typeof lineNumbers === "boolean" ? lineNumbers : defaults.lineNumbers;
    this.defaultViewMode = isOneOf(VIEW_MODES, defaultViewMode) ? defaultViewMode : defaults.defaultViewMode;
    this.watchFiles = typeof watchFiles === "boolean" ? watchFiles : defaults.watchFiles;
    this.dockPromptDismissed =
      typeof dockPromptDismissed === "boolean" ? dockPromptDismissed : defaults.dockPromptDismissed;
    this.locale = isOneOf(LOCALES, locale) ? locale : defaults.locale;
    this.recentFilesLimit =
      typeof recentFilesLimit === "number" &&
      Number.isInteger(recentFilesLimit) &&
      recentFilesLimit >= appConfig.behavior.recentFilesLimitMin &&
      recentFilesLimit <= appConfig.behavior.recentFilesLimitMax
        ? recentFilesLimit
        : defaults.recentFilesLimit;
    this.aiChatEnabled = typeof aiChatEnabled === "boolean" ? aiChatEnabled : defaults.aiChatEnabled;
    this.aiProvider = isOneOf(AI_PROVIDERS, aiProvider) ? aiProvider : defaults.aiProvider;
    // AI-SEC-001: un valor corrupto/editado a mano en disco que no sea ""
    // (sin configurar) ni `https://` cae al default, igual que cualquier
    // otra preferencia inválida (CFG-004) — el rechazo activo al escribir
    // vive en `setAiBaseUrl`.
    this.aiBaseUrl =
      typeof aiBaseUrl === "string" && (aiBaseUrl === "" || aiBaseUrl.startsWith("https://"))
        ? aiBaseUrl
        : defaults.aiBaseUrl;
    this.aiModelId = typeof aiModelId === "string" ? aiModelId : defaults.aiModelId;
    this.aiByokContextTokens =
      typeof aiByokContextTokens === "number" &&
      Number.isInteger(aiByokContextTokens) &&
      aiByokContextTokens >= appConfig.behavior.aiByokContextTokensMin
        ? aiByokContextTokens
        : defaults.aiByokContextTokens;
    this.aiUseLocalModel = typeof aiUseLocalModel === "boolean" ? aiUseLocalModel : defaults.aiUseLocalModel;
  }

  #applyDom(): void {
    this.resolvedTheme =
      this.themeMode === "system"
        ? this.#media?.matches
          ? "dark"
          : "light"
        : this.themeMode;
    document.documentElement.dataset.palette = this.palette;
    document.documentElement.dataset.theme = this.resolvedTheme;
    document.documentElement.lang = this.locale;
    document.documentElement.style.setProperty("--fs-editor", `${this.editorFontSize}px`);
    setI18nLocale(this.locale);
  }

  async #persist(key: string, value: unknown): Promise<void> {
    if (!this.#store) return;
    await this.#store.set(key, value);
    await this.#store.save();
  }

  setThemeMode(mode: ThemeMode): void {
    this.themeMode = mode;
    this.#applyDom();
    void this.#persist("themeMode", mode);
  }

  /** Dock "Tema": cicla Sistema -> Claro -> Oscuro -> Sistema (UI-SCREENS §4). */
  cycleThemeMode(): void {
    const currentIndex = THEME_MODES.indexOf(this.themeMode);
    const nextIndex = (currentIndex + 1) % THEME_MODES.length;
    this.setThemeMode(THEME_MODES[nextIndex]);
  }

  setPalette(palette: PalKey): void {
    this.palette = palette;
    this.#applyDom();
    void this.#persist("palette", palette);
  }

  setDockPosition(position: DockPosition): void {
    this.dockPosition = position;
    void this.#persist("dockPosition", position);
  }

  /** BL-021 (zoom Mod+=/-/0): clamp a [editorFontSizeMin, editorFontSizeMax]. */
  setEditorFontSize(size: number): void {
    const clamped = Math.min(
      appConfig.behavior.editorFontSizeMax,
      Math.max(appConfig.behavior.editorFontSizeMin, size),
    );
    this.editorFontSize = clamped;
    document.documentElement.style.setProperty("--fs-editor", `${clamped}px`);
    void this.#persist("editorFontSize", clamped);
  }

  setLineNumbers(enabled: boolean): void {
    this.lineNumbers = enabled;
    void this.#persist("lineNumbers", enabled);
  }

  /** UI-SCREENS §2: estado del FormatToggle ("Aa") persistido. */
  setFormatToolbarVisible(visible: boolean): void {
    this.formatToolbarVisible = visible;
    void this.#persist("formatToolbarVisible", visible);
  }

  toggleFormatToolbarVisible(): void {
    this.setFormatToolbarVisible(!this.formatToolbarVisible);
  }

  setDefaultViewMode(mode: ViewMode): void {
    this.defaultViewMode = mode;
    void this.#persist("defaultViewMode", mode);
  }

  /** SPEC-CORE-019 / SEC-010: activa/desactiva la vigilancia de archivos abiertos. */
  setWatchFiles(enabled: boolean): void {
    this.watchFiles = enabled;
    void this.#persist("watchFiles", enabled);
  }

  /** PD-28: el aviso de Dock (mac) no vuelve a mostrarse tras la primera vez,
   * salvo que Preferencias → Sistema lo reactive explícitamente. */
  setDockPromptDismissed(dismissed: boolean): void {
    this.dockPromptDismissed = dismissed;
    void this.#persist("dockPromptDismissed", dismissed);
  }

  /** BL-054: cambio de idioma en caliente — ver nota en i18n/index.svelte.ts. */
  setLocale(locale: Locale): void {
    this.locale = locale;
    this.#applyDom();
    void this.#persist("locale", locale);
  }

  /** SPEC-CORE-021/PD-56: cantidad de archivos visibles en `RecentFilesList`. */
  setRecentFilesLimit(limit: number): void {
    const clamped = Math.min(
      appConfig.behavior.recentFilesLimitMax,
      Math.max(appConfig.behavior.recentFilesLimitMin, limit),
    );
    this.recentFilesLimit = clamped;
    void this.#persist("recentFilesLimit", clamped);
  }

  /** UI-SCREENS §10/PD-65: switch maestro — apagarlo suelta el modelo local
   * de RAM en `ai-model.svelte.ts` (efecto separado, mismo patrón que
   * `syncFileWatchers` para `watchFiles`, ver AppShell.svelte). */
  setAiChatEnabled(enabled: boolean): void {
    this.aiChatEnabled = enabled;
    void this.#persist("aiChatEnabled", enabled);
  }

  /** PD-83: elegir un preset con URL fija precarga `aiBaseUrl` (editable
   * después); "ninguno"/"personalizado" la dejan como estaba. */
  setAiProvider(provider: AiProvider): void {
    this.aiProvider = provider;
    void this.#persist("aiProvider", provider);
    if (provider !== "none" && provider !== "custom") {
      this.#applyAiBaseUrl(appConfig.ai.presetBaseUrls[provider]);
    }
  }

  #applyAiBaseUrl(url: string): void {
    this.aiBaseUrl = url;
    void this.#persist("aiBaseUrl", url);
  }

  /** AI-SEC-001: rechaza al guardar cualquier `aiBaseUrl` que no sea
   * `https://` (o vacía, "sin configurar") — devuelve si se aplicó. */
  setAiBaseUrl(url: string): boolean {
    if (url !== "" && !url.startsWith("https://")) return false;
    this.#applyAiBaseUrl(url);
    return true;
  }

  setAiModelId(modelId: string): void {
    this.aiModelId = modelId;
    void this.#persist("aiModelId", modelId);
  }

  /** PD-70/BL-124: entero positivo — 0/negativos/no-enteros se recortan al
   * mínimo válido en vez de guardarse (mismo criterio de clamp que
   * `setEditorFontSize`/`setRecentFilesLimit`). */
  setAiByokContextTokens(tokens: number): void {
    const clamped = Math.max(appConfig.behavior.aiByokContextTokensMin, Math.trunc(tokens));
    this.aiByokContextTokens = clamped;
    void this.#persist("aiByokContextTokens", clamped);
  }

  setAiUseLocalModel(enabled: boolean): void {
    this.aiUseLocalModel = enabled;
    void this.#persist("aiUseLocalModel", enabled);
  }

  /** UI-SCREENS §8: botón "Restablecer valores predeterminados". */
  resetToDefaults(): void {
    this.setThemeMode(defaults.themeMode);
    this.setPalette(defaults.palette);
    this.setEditorFontSize(defaults.editorFontSize);
    this.setDockPosition(defaults.dockPosition);
    this.setFormatToolbarVisible(defaults.formatToolbarVisible);
    this.setLineNumbers(defaults.lineNumbers);
    this.setDefaultViewMode(defaults.defaultViewMode);
    this.setWatchFiles(defaults.watchFiles);
    this.setLocale(defaults.locale);
    this.setRecentFilesLimit(defaults.recentFilesLimit);
    this.setAiChatEnabled(defaults.aiChatEnabled);
    this.setAiProvider(defaults.aiProvider);
    this.#applyAiBaseUrl(defaults.aiBaseUrl);
    this.setAiModelId(defaults.aiModelId);
    this.setAiByokContextTokens(defaults.aiByokContextTokens);
    this.setAiUseLocalModel(defaults.aiUseLocalModel);
    // dockPromptDismissed (mac) no se restablece aquí a propósito: PD-28 es
    // "una vez"; "Restablecer" no debe reabrir el aviso de Dock por sorpresa.
    // El botón dedicado de Preferencias → Sistema ya cubre ese caso.
  }
}

export const preferences = new PreferencesStore();
