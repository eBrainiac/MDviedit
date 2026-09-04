/**
 * Config de app — MDviedit (capa 2, ADR-006).
 * Fuente: SPEC.md, UI-TOUCH-CONTROLS.md §4, UI-SCREENS.md §8, DISTRIBUTION.md §2.
 * CFG-001: ningún componente Svelte/TS declara estos valores como literales;
 * siempre se importan de aquí. CFG-004: toda preferencia tiene su default aquí.
 */

export type PalKey = "a" | "b" | "c";
export type ThemeMode = "system" | "light" | "dark";
export type DockPosition = "left" | "right" | "top" | "bottom";
export type ViewMode = "raw" | "formatted";
export type Locale = "es-MX" | "en";

interface ShortcutMap {
  readonly newFile: string;
  readonly open: string;
  readonly save: string;
  readonly saveAs: string;
  readonly closeTab: string;
  readonly nextTab: string;
  readonly prevTab: string;
  readonly nextTabMac: string;
  readonly prevTabMac: string;
  readonly goToTab: readonly string[];
  readonly heading1: string;
  readonly heading2: string;
  readonly heading3: string;
  readonly headingClear: string;
  readonly preferences: string;
  readonly toggleView: string;
  readonly toggleFormatToolbar: string;
  readonly toggleTheme: string;
  readonly zoomIn: string;
  readonly zoomOut: string;
  readonly zoomReset: string;
  readonly quitWin: string;
  readonly quitMac: string;
  // UI-TOUCH-CONTROLS §2 (FormatToolbar) — funcionan aunque esté oculta (IN-015).
  readonly bold: string;
  readonly italic: string;
  readonly strikethrough: string;
  readonly inlineCode: string;
  readonly list: string;
  readonly listOrdered: string;
  readonly task: string;
  readonly quote: string;
  readonly link: string;
  readonly image: string;
  readonly codeBlock: string;
}

interface FileFilter {
  readonly name: string;
  readonly extensions: readonly string[];
}

interface CliConfig {
  readonly binaryName: string;
  readonly flags: {
    readonly newFile: string;
    readonly version: string;
  };
}

interface BehaviorTokens {
  readonly editorFontSizeMin: number;
  readonly editorFontSizeMax: number;
  readonly editorFontSizeStep: number;
  readonly tooltipDelayMs: number;
  readonly tabEllipsisKeepExtMinPx: number;
  readonly tabScrollRepeatMs: number;
  /** IN-025: movimiento mínimo antes de que arrastrar una pestaña reordene
   * (evita que un clic simple se interprete como el inicio de un arrastre). */
  readonly tabDragThresholdPx: number;
  readonly dockDropZonePx: number;
  readonly viewSwitchDebounceMs: number;
  readonly maxFolderOpen: number;
  readonly fileWatchDebounceMs: number;
  readonly largeFileThresholdBytes: number;
  readonly breakpoints: {
    readonly compactMaxPx: number;
    readonly wideMinPx: number;
  };
  readonly untitledPrefixKey: string;
  /** IN-014: botones visibles antes de colapsar al popover "⋯" en `compact`. */
  readonly toolbarCompactVisibleCount: number;
}

interface WindowConfig {
  readonly minWidth: number;
  readonly minHeight: number;
}

interface StoreConfig {
  readonly preferencesFile: string;
  readonly sessionFile: string;
}

interface PreferencesDefaults {
  readonly themeMode: ThemeMode;
  readonly palette: PalKey;
  readonly editorFontSize: number;
  readonly dockPosition: DockPosition;
  readonly formatToolbarVisible: boolean;
  readonly lineNumbers: boolean;
  readonly defaultViewMode: ViewMode;
  readonly watchFiles: boolean;
  readonly dockPromptDismissed: boolean;
  readonly locale: Locale;
}

interface AppConfig {
  readonly name: string;
  readonly id: string;
  readonly window: WindowConfig;
  readonly store: StoreConfig;
  readonly shortcuts: ShortcutMap;
  readonly fileFilters: FileFilter;
  readonly cli: CliConfig;
  readonly behavior: BehaviorTokens;
  readonly preferencesDefaults: PreferencesDefaults;
}

export const appConfig = {
  name: "MDviedit",
  id: "mx.mdviedit.app",

  window: {
    minWidth: 640,
    minHeight: 400,
  },

  // ADR-006 capa 4: tauri-plugin-store persiste esto en appConfigDir.
  store: {
    preferencesFile: "preferences.json",
    // SPEC-CORE-016: rutas + viewMode + scroll de la sesión anterior.
    sessionFile: "session.json",
  },

  // UI-TOUCH-CONTROLS.md §4 — "Mod" = Ctrl (Windows) / Cmd (macOS).
  shortcuts: {
    newFile: "Mod+N",
    open: "Mod+O",
    save: "Mod+S",
    saveAs: "Mod+Shift+S",
    closeTab: "Mod+W",
    nextTab: "Ctrl+Tab",
    prevTab: "Ctrl+Shift+Tab",
    nextTabMac: "Mod+Alt+ArrowRight",
    prevTabMac: "Mod+Alt+ArrowLeft",
    goToTab: ["Mod+1", "Mod+2", "Mod+3", "Mod+4", "Mod+5", "Mod+6", "Mod+7", "Mod+8", "Mod+9"],
    heading1: "Mod+Alt+1",
    heading2: "Mod+Alt+2",
    heading3: "Mod+Alt+3",
    headingClear: "Mod+Alt+0",
    preferences: "Mod+,",
    toggleView: "Mod+Shift+V",
    toggleFormatToolbar: "Mod+Shift+F",
    toggleTheme: "Mod+Shift+T",
    zoomIn: "Mod+=",
    zoomOut: "Mod+-",
    zoomReset: "Mod+0",
    quitWin: "Alt+F4",
    quitMac: "Cmd+Q",
    bold: "Mod+B",
    italic: "Mod+I",
    strikethrough: "Mod+Shift+X",
    inlineCode: "Mod+E",
    list: "Mod+Shift+8",
    listOrdered: "Mod+Shift+7",
    task: "Mod+Shift+9",
    quote: "Mod+Shift+.",
    link: "Mod+K",
    image: "Mod+Shift+K",
    codeBlock: "Mod+Shift+C",
  },

  // SPEC-CORE-001, INST-010 (PD-23).
  fileFilters: {
    name: "Markdown",
    extensions: ["md", "markdown", "txt"],
  },

  // DISTRIBUTION.md INST-014.
  cli: {
    binaryName: "mdviedit",
    flags: {
      newFile: "--new",
      version: "--version",
    },
  },

  // UI-DESIGN-SYSTEM.md §7b.
  behavior: {
    // §2 --fs-editor-min / --fs-editor-max, expuestos aquí para validar
    // preferences.editorFontSize (CFG-004) sin duplicar a mano el token CSS.
    editorFontSizeMin: 10,
    editorFontSizeMax: 24,
    // Incremento por pulsación de Mod+=/Mod+- (UI-TOUCH-CONTROLS §4).
    editorFontSizeStep: 1,
    tooltipDelayMs: 500,
    tabEllipsisKeepExtMinPx: 72,
    tabScrollRepeatMs: 150,
    tabDragThresholdPx: 4,
    dockDropZonePx: 48,
    viewSwitchDebounceMs: 150,
    maxFolderOpen: 20,
    fileWatchDebounceMs: 300,
    largeFileThresholdBytes: 2_097_152,
    breakpoints: {
      compactMaxPx: 719,
      wideMinPx: 1280,
    },
    untitledPrefixKey: "tab.untitled",
    toolbarCompactVisibleCount: 8,
  },

  // UI-SCREENS.md §8 (SPEC-CORE-018, CFG-004).
  preferencesDefaults: {
    themeMode: "system",
    palette: "b",
    editorFontSize: 14,
    dockPosition: "right",
    formatToolbarVisible: false,
    lineNumbers: false,
    defaultViewMode: "formatted",
    watchFiles: true,
    dockPromptDismissed: false,
    locale: "es-MX",
  },
} as const satisfies AppConfig;

export type { AppConfig };
