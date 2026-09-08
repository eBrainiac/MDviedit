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
// SPEC-CORE-023 / ADR-013: 'markdown' = Formato + Sin formato (Milkdown +
// CodeMirror, comportamiento actual); 'code' = vista única de código
// (solo CodeMirror, sin Formato/WYSIWYG — PD-86).
export type EditMode = "markdown" | "code";
// ADR-013: paquete de lenguaje de CodeMirror 6 a cargar (BL-126, PD-90) —
// carga diferida vía import() dinámico (src/lib/editor/language-loader.ts,
// ver NFR-008 en ADR-013 §Consecuencias).
export type LanguagePackage =
  | "@codemirror/lang-python"
  | "@codemirror/lang-json"
  | "@codemirror/lang-javascript"
  | "@codemirror/lang-yaml"
  | "@codemirror/lang-css"
  | "@codemirror/lang-html";
// SPEC-CORE-022 / ADR-010 / PD-57/77/78/83: "none" = sin BYOK configurado
// (usa el modelo local si `aiUseLocalModel`). Todos salvo "anthropic" hablan
// el esquema OpenAI-compatible (BL-119) — solo cambia la `aiBaseUrl`
// precargada por el preset elegido; "custom" deja `aiBaseUrl` completamente
// libre. "anthropic" usa el esquema nativo de Anthropic aparte (PD-78).
export type AiProvider =
  | "none"
  | "openai"
  | "anthropic"
  | "openrouter"
  | "nous"
  | "together"
  | "groq"
  | "custom";
// Backend activo de una conversación del Chat de IA (PD-57, "cambiable por
// conversación" — UI-SCREENS §10).
export type AiBackend = "byok" | "local";

interface ShortcutMap {
  readonly newFile: string;
  readonly open: string;
  readonly save: string;
  readonly saveAs: string;
  readonly closeTab: string;
  /** SPEC-CORE-007 (enmienda), PD-94: alias de `closeTab` solo en Windows. */
  readonly closeTabWin: string;
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

/** ADR-013: entrada del registro central de tipos de archivo. */
export interface FileTypeDescriptor {
  readonly editMode: EditMode;
  readonly languagePackage?: LanguagePackage;
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
  /** SPEC-CORE-021/PD-56: rango del stepper de `recentFilesLimit` en
   * Preferencias → Archivos (sin límite documentado en SPEC/BACKLOG más
   * allá del default 10 — rango elegido igual que el stepper análogo de
   * `editorFontSize`, a confirmar con Sebastian si necesita otro). */
  readonly recentFilesLimitMin: number;
  readonly recentFilesLimitMax: number;
  /** UI-SCREENS §1/§3: divisores para la hora relativa de `RecentFilesList`
   * ("hace 2 h", "ayer") vía Intl.RelativeTimeFormat — ms por unidad. */
  readonly recentTimeMinuteMs: number;
  readonly recentTimeHourMs: number;
  readonly recentTimeDayMs: number;
  readonly recentTimeWeekMs: number;
  readonly recentTimeMonthMs: number;
  readonly recentTimeYearMs: number;
  /** SPEC-CORE-022 / PD-61: contexto nativo de Qwen3.5-4B (262K tokens),
   * usado para decidir cuándo BL-114 recurre a map-reduce. */
  readonly aiLocalContextTokens: number;
  /** PD-70/BL-124: `aiByokContextTokens` (Preferencias → IA) es ahora
   * configurable por el usuario — BYOK genérico (PD-77/83, IT-10) puede
   * apuntar a cualquier proveedor con cualquier ventana de contexto real.
   * Este es solo el límite inferior de validación (entero positivo). */
  readonly aiByokContextTokensMin: number;
  /** Incremento del stepper de Preferencias → IA — sin valor fijado en
   * ningún doc (PD-70 solo definió el campo, no la granularidad del
   * control); elegido para moverse en pasos parecidos a ventanas de
   * contexto reales (8K) en vez de saltos de a uno. */
  readonly aiByokContextTokensStep: number;
  /** Heurística de estimación de tokens (BL-114) sin tokenizador real:
   * caracteres por token aproximados para texto en Markdown/prosa. */
  readonly aiCharsPerTokenEstimate: number;
  /** BL-115: por encima de este número de líneas, el diff antes/después
   * reporta un reemplazo completo en vez de pagar el costo O(n*m) del LCS
   * línea a línea (ver src/lib/ai/text-diff.ts). */
  readonly aiDiffMaxLines: number;
  /** BL-114: fracción del contexto del modelo reservada para el contenido
   * de los archivos (el resto queda para las instrucciones del prompt). */
  readonly aiContextBudgetFraction: number;
  /** AI-SEC-002 / ADR-010 (actualización PD-79/BL-120): timeout de red por
   * petición BYOK a un endpoint arbitrario. */
  readonly aiByokTimeoutMs: number;
  /** AI-SEC-003 / ADR-010 (actualización PD-79/BL-120): una respuesta BYOK
   * mayor a este límite se descarta con error, nunca se procesa parcial. */
  readonly aiByokMaxResponseBytes: number;
}

interface WindowConfig {
  readonly minWidth: number;
  readonly minHeight: number;
}

interface StoreConfig {
  readonly preferencesFile: string;
  readonly sessionFile: string;
  readonly recentFilesFile: string;
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
  readonly recentFilesLimit: number;
  readonly aiChatEnabled: boolean;
  readonly aiProvider: AiProvider;
  /** PD-77: URL base del endpoint BYOK — "" hasta que se elige un preset o
   * se escribe una personalizada; nunca `http://` (AI-SEC-001). */
  readonly aiBaseUrl: string;
  /** PD-77: id de modelo en texto libre para el endpoint BYOK activo. */
  readonly aiModelId: string;
  /** PD-70/BL-124: reemplaza el supuesto fijo de 128K — el usuario ajusta
   * el umbral real que dispara map-reduce (PD-64) cuando el backend activo
   * es BYOK. 128000 es solo el valor inicial sugerido, no un tope. */
  readonly aiByokContextTokens: number;
  /** SPEC-CORE-022 (enmienda)/PD-93/BUG-12: switch dedicado, apagado por
   * default — el usuario debe encenderlo a mano (en la pestaña "Modelo
   * local" del panel de Chat o en Preferencias → IA) antes de que se
   * ofrezca la descarga del modelo local. Segundo gate aparte de
   * `aiChatEnabled`: abrir el panel del Chat por sí solo nunca dispara la
   * descarga (ver AppShell.svelte). */
  readonly aiUseLocalModel: boolean;
}

/** SPEC-CORE-022 / ADR-010 / PD-61/62/66: parámetros del modelo local
 * empaquetado (Qwen3.5-4B GGUF Q4_K_M, repo `unsloth/Qwen3.5-4B-GGUF`,
 * confirmado por Cowork — PD-66). `localModelSha256` viene de la API de
 * metadatos LFS de Hugging Face, no de una descarga propia. */
interface AiModelConfig {
  readonly localModelFileName: string;
  readonly localModelDownloadUrl: string;
  /** `null` = sin hash de referencia (se salta la verificación de
   * integridad); con un valor, `ai_model_download_start` la aplica siempre
   * (ver src-tauri/src/ai_download.rs). */
  readonly localModelSha256: string | null;
  readonly localModelSizeBytesApprox: number;
  /** PD-83/BL-119: URL base que cada preset de Preferencias → IA precarga en
   * `aiBaseUrl` (editable después) — verificadas contra la documentación
   * oficial de cada proveedor (2026-09-05), no de memoria. "custom" no entra
   * aquí: deja `aiBaseUrl` completamente libre. */
  readonly presetBaseUrls: Readonly<Record<Exclude<AiProvider, "none" | "custom">, string>>;
}

interface AppConfig {
  readonly name: string;
  readonly id: string;
  /** BL-122: nombre del binario Cargo (`[package] name` en Cargo.toml) —
   * necesario en `tauri.conf.json` (`mainBinaryName`) porque `src-tauri`
   * ya no tiene un solo `[[bin]]`: `ai_local_harness` (arnés de
   * verificación de BL-110) hace que `tauri build` ya no pueda inferir solo
   * cuál binario es la app real a empaquetar. */
  readonly mainBinaryName: string;
  readonly window: WindowConfig;
  readonly store: StoreConfig;
  readonly shortcuts: ShortcutMap;
  readonly fileFilters: FileFilter;
  readonly cli: CliConfig;
  readonly behavior: BehaviorTokens;
  readonly preferencesDefaults: PreferencesDefaults;
  readonly ai: AiModelConfig;
}

/**
 * Dispatcher genérico de tipo de archivo por extensión (BL-125, ADR-013,
 * SPEC-CORE-023). Fuente única: `.md`/`.markdown` y `.txt` migrados aquí
 * sin cambiar su comportamiento observable (refactor interno); `fileFilters`
 * más abajo deriva su lista de extensiones de este mismo registro, así que
 * agregar un tipo nuevo aquí ya alcanza a INST-010 (BL-128) sin duplicar la
 * lista. Alcance inicial de código con resaltado (PD-90): ver tabla en
 * ADR-013.
 */
const fileTypeRegistry: Readonly<Record<string, FileTypeDescriptor>> = {
  md: { editMode: "markdown" },
  markdown: { editMode: "markdown" },
  txt: { editMode: "code" },
  py: { editMode: "code", languagePackage: "@codemirror/lang-python" },
  json: { editMode: "code", languagePackage: "@codemirror/lang-json" },
  js: { editMode: "code", languagePackage: "@codemirror/lang-javascript" },
  ts: { editMode: "code", languagePackage: "@codemirror/lang-javascript" },
  yaml: { editMode: "code", languagePackage: "@codemirror/lang-yaml" },
  yml: { editMode: "code", languagePackage: "@codemirror/lang-yaml" },
  css: { editMode: "code", languagePackage: "@codemirror/lang-css" },
  html: { editMode: "code", languagePackage: "@codemirror/lang-html" },
};

/**
 * ADR-013: `path === null` (pestaña nueva sin guardar, SPEC-CORE-002) →
 * Markdown, mismo comportamiento que hoy. Extensión no registrada → texto
 * plano sin resaltado (mismo trato que `.txt`), para que abrir un archivo
 * de un tipo desconocido (p. ej. por línea de comandos) nunca falle.
 */
export function fileTypeForPath(path: string | null): FileTypeDescriptor {
  if (!path) return fileTypeRegistry.md;
  const match = /\.([^./\\]+)$/.exec(path);
  const ext = match?.[1]?.toLowerCase();
  return (ext && fileTypeRegistry[ext]) || fileTypeRegistry.txt;
}

export const appConfig = {
  name: "MDviedit",
  mainBinaryName: "mdviedit",
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
    // SPEC-CORE-021: historial de `lastAccessedAt` por ruta (BL-108).
    recentFilesFile: "recent-files.json",
  },

  // UI-TOUCH-CONTROLS.md §4 — "Mod" = Ctrl (Windows) / Cmd (macOS).
  shortcuts: {
    newFile: "Mod+N",
    open: "Mod+O",
    save: "Mod+S",
    saveAs: "Mod+Shift+S",
    closeTab: "Mod+W",
    closeTabWin: "Ctrl+F4",
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

  // SPEC-CORE-001/023, INST-010 (PD-23, PD-89/90): lista derivada de
  // fileTypeRegistry — una sola fuente para el dispatcher (ADR-013) y para
  // fileAssociations (BL-128, CFG-003, pnpm sync-config).
  fileFilters: {
    name: "MDviedit",
    extensions: Object.keys(fileTypeRegistry),
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
    recentFilesLimitMin: 1,
    recentFilesLimitMax: 50,
    recentTimeMinuteMs: 60_000,
    recentTimeHourMs: 3_600_000,
    recentTimeDayMs: 86_400_000,
    recentTimeWeekMs: 604_800_000,
    recentTimeMonthMs: 2_592_000_000,
    recentTimeYearMs: 31_536_000_000,
    aiLocalContextTokens: 262_144,
    aiByokContextTokensMin: 1,
    aiByokContextTokensStep: 8_000,
    aiCharsPerTokenEstimate: 4,
    aiDiffMaxLines: 2000,
    aiContextBudgetFraction: 0.8,
    aiByokTimeoutMs: 30_000,
    aiByokMaxResponseBytes: 10_485_760,
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
    recentFilesLimit: 10,
    aiChatEnabled: false,
    aiProvider: "none",
    aiBaseUrl: "",
    aiModelId: "",
    aiByokContextTokens: 128_000,
    aiUseLocalModel: false,
  },

  // SPEC-CORE-022 / ADR-010 / PD-61/62 / PD-66: repo/archivo confirmado por
  // Cowork (2026-09-04) — unsloth/Qwen3.5-4B-GGUF, Apache 2.0. Tamaño y
  // sha256 obtenidos directamente de la API de metadatos LFS de Hugging Face
  // (`huggingface.co/api/models/unsloth/Qwen3.5-4B-GGUF?blobs=true`), no de
  // una descarga propia — es la fuente más autorizada posible sin depender
  // de una descarga completa de 2.74 GB solo para calcular el hash.
  ai: {
    localModelFileName: "Qwen3.5-4B-Q4_K_M.gguf",
    localModelDownloadUrl: "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf",
    localModelSha256: "00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4",
    localModelSizeBytesApprox: 2_740_937_888,
    // Verificadas 2026-09-05 contra la documentación oficial de cada
    // proveedor (no de memoria, PD-77/83): OpenAI (platform.openai.com),
    // Anthropic (docs.anthropic.com), OpenRouter (openrouter.ai/docs),
    // Nous Portal (inference-api.nousresearch.com, esquema OpenAI-compatible
    // de Hermes Agent), Together AI (docs.together.ai), Groq (console.groq.com/docs/openai).
    presetBaseUrls: {
      openai: "https://api.openai.com/v1",
      anthropic: "https://api.anthropic.com/v1",
      openrouter: "https://openrouter.ai/api/v1",
      nous: "https://inference-api.nousresearch.com/v1",
      together: "https://api.together.ai/v1",
      groq: "https://api.groq.com/openai/v1",
    },
  },
} as const satisfies AppConfig;

export type { AppConfig };
