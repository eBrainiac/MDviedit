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
    // dockPromptDismissed (mac) no se restablece aquí a propósito: PD-28 es
    // "una vez"; "Restablecer" no debe reabrir el aviso de Dock por sorpresa.
    // El botón dedicado de Preferencias → Sistema ya cubre ese caso.
  }
}

export const preferences = new PreferencesStore();
