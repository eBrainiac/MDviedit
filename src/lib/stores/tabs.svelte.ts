/**
 * TabStore real (BL-020, MEM-001/002): solo la pestaña activa tiene un
 * editor montado; las demás viven como datos, incluyendo el `EditorState`
 * de CodeMirror ya creado (no destruido, solo desmontado de la vista) para
 * conservar el historial de deshacer sin serializar/deserializar árboles
 * de historia a mano (PD-21, AT-065) — es el patrón recomendado por
 * CodeMirror 6 para editores multi-documento.
 */
import type { EditorState } from "@codemirror/state";
import { open as openDialog, save as saveDialog, message } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { appConfig, type ViewMode } from "../../config/app.config";
import { t } from "../../i18n";
import { loadSession, saveSession, type SessionTab } from "../session";
import { preferences } from "./preferences.svelte";

export type TabKind = "file" | "preferences";

export interface Tab {
  readonly id: string;
  path: string | null;
  title: string;
  text: string;
  dirty: boolean;
  viewMode: ViewMode;
  readonly kind: TabKind;
  editorState: EditorState | null;
  scroll: number;
  width: number | null;
  focusOnMount: boolean;
  /** NFR-005 / PD-43: > largeFileThresholdBytes — LargeFileNotice (BL-035). */
  large: boolean;
  /** SPEC-CORE-019: se incrementa en cada `reloadFromDisk`, para que
   * ContentArea remonte el editor (`{#key}`) con el texto nuevo aunque la
   * pestaña recargada sea la activa. */
  reloadNonce: number;
}

const PREFERENCES_TAB_ID = "preferences";

function pathsEqual(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: "base" }) === 0;
}

function basename(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

function dirname(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  return normalized.slice(0, normalized.lastIndexOf("/"));
}

export class TabsStore {
  tabs = $state<Tab[]>([]);
  activeId = $state<string | null>(null);
  sessionRestored = $state(false);

  #untitledCount = 0;
  #nextId = 0;

  get active(): Tab | null {
    return this.tabs.find((tab) => tab.id === this.activeId) ?? null;
  }

  #makeId(): string {
    this.#nextId += 1;
    return `tab-${this.#nextId}`;
  }

  #findByPath(path: string): Tab | undefined {
    return this.tabs.find((tab) => tab.path !== null && pathsEqual(tab.path, path));
  }

  #insertAndActivate(tab: Tab): void {
    this.tabs = [...this.tabs, tab];
    this.activeId = tab.id;
  }

  /**
   * Fuerza a `tabs` a una nueva referencia de array tras mutar un campo de
   * una de sus pestañas. `$state` en un array es profundamente reactivo,
   * pero un `$derived`/plantilla que solo leyó `tabsStore.active` (un
   * `.find()`) no queda suscrito a los campos internos de ESE elemento
   * hasta que `tabs` cambia de referencia — de lo contrario StatusBar/
   * TabBar no reflejan `dirty`/`text` al mutarlos desde otro componente
   * (p. ej. RawEditorView). Ver AT-022.
   */
  #touch(): void {
    this.tabs = [...this.tabs];
  }

  /** SPEC-CORE-002 / AT-010. */
  newTab(): void {
    this.#untitledCount += 1;
    this.#insertAndActivate({
      id: this.#makeId(),
      path: null,
      title: t("tab.untitled", { n: this.#untitledCount }),
      text: "",
      dirty: false,
      viewMode: preferences.defaultViewMode,
      kind: "file",
      editorState: null,
      scroll: 0,
      width: null,
      focusOnMount: true,
      large: false,
      reloadNonce: 0,
    });
  }

  /** SPEC-CORE-001 / AT-010: diálogo nativo de Abrir (multi). */
  async openDialog(): Promise<void> {
    const selection = await openDialog({
      multiple: true,
      filters: [{ name: appConfig.fileFilters.name, extensions: [...appConfig.fileFilters.extensions] }],
    });
    if (!selection) return;
    const paths = Array.isArray(selection) ? selection : [selection];
    await this.openPaths(paths);
  }

  /** AT-011/AT-012: abre cada ruta en su pestaña; duplicado activa la existente. */
  async openPaths(paths: readonly string[], viewModes?: ReadonlyMap<string, ViewMode>): Promise<void> {
    for (const path of paths) {
      const existing = this.#findByPath(path);
      if (existing) {
        this.activeId = existing.id;
        continue;
      }
      try {
        const text = await invoke<string>("read_text_file", { path });
        void invoke("allow_asset_folder", { dir: dirname(path) }).catch(() => {});

        // NFR-005 / PD-43: archivos grandes abren en Sin formato con aviso
        // (LargeFileNotice), sin importar defaultViewMode o la sesión previa.
        const byteLength = new TextEncoder().encode(text).length;
        const isLarge = byteLength > appConfig.behavior.largeFileThresholdBytes;
        const viewMode: ViewMode = isLarge ? "raw" : (viewModes?.get(path) ?? preferences.defaultViewMode);

        this.#insertAndActivate({
          id: this.#makeId(),
          path,
          title: basename(path),
          text,
          dirty: false,
          viewMode,
          kind: "file",
          editorState: null,
          scroll: 0,
          width: null,
          focusOnMount: false,
          large: isLarge,
          reloadNonce: 0,
        });
      } catch {
        await message(t("dialog.ioErrorRead", { file: basename(path) }), {
          title: t("dialog.ioErrorTitle"),
          kind: "error",
        });
      }
    }
    void this.#persistSession();
  }

  /** Dock "Preferencias" (§4): pestaña especial única. */
  openPreferences(): void {
    const existing = this.tabs.find((tab) => tab.kind === "preferences");
    if (existing) {
      this.activeId = existing.id;
      return;
    }
    this.#insertAndActivate({
      id: PREFERENCES_TAB_ID,
      path: null,
      title: t("preferences.tabTitle"),
      text: "",
      dirty: false,
      viewMode: "formatted",
      kind: "preferences",
      editorState: null,
      scroll: 0,
      width: null,
      focusOnMount: false,
      large: false,
      reloadNonce: 0,
    });
  }

  activate(id: string): void {
    if (this.tabs.some((tab) => tab.id === id)) this.activeId = id;
  }

  setContent(id: string, text: string): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab || tab.kind !== "file") return;
    tab.text = text;
    tab.dirty = true;
    this.#touch();
  }

  setViewMode(id: string, viewMode: ViewMode): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    tab.viewMode = viewMode;
    this.#touch();
  }

  /** LargeFileNotice → "Abrir en Formato de todos modos" (UI-SCREENS §3). */
  openLargeFileAnyway(id: string): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    tab.large = false;
    tab.viewMode = "formatted";
    this.#touch();
  }

  /** TAB-011: ancho por pestaña; `null` = usar `--tab-default-w` (CSS). */
  setWidth(id: string, width: number | null): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    tab.width = width;
    this.#touch();
  }

  /** IN-025: arrastrar una pestaña la reordena a la posición `toIndex`. */
  reorder(id: string, toIndex: number): void {
    const fromIndex = this.tabs.findIndex((t) => t.id === id);
    if (fromIndex === -1) return;
    const clampedTo = Math.max(0, Math.min(toIndex, this.tabs.length - 1));
    if (clampedTo === fromIndex) return;
    const next = [...this.tabs];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(clampedTo, 0, moved);
    this.tabs = next;
  }

  /**
   * Estas tres solo las llaman RawEditorView/WysiwygEditorView. `tab` les
   * llega como prop (no `bind:`), así que mutar sus campos directamente
   * dispara `ownership_invalid_mutation` en dev — y, combinado con que esos
   * mismos campos se leen de forma síncrona en otro efecto, puede encadenar
   * un `effect_update_depth_exceeded` que congela toda la reactividad de la
   * página. Pasar siempre por el store evita ambas cosas.
   */
  setScroll(id: string, scroll: number): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    tab.scroll = scroll;
  }

  setEditorState(id: string, state: EditorState): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    tab.editorState = state;
  }

  consumeFocusOnMount(id: string): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    tab.focusOnMount = false;
  }

  /** SPEC-CORE-006 / AT-017/018: si no tiene ruta, delega a Guardar como. */
  async save(id: string): Promise<boolean> {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return false;
    if (!tab.path) return this.saveAs(id);

    try {
      await invoke("write_text_file_atomic", { path: tab.path, contents: tab.text });
      tab.dirty = false;
      this.#touch();
      void this.#persistSession();
      return true;
    } catch {
      await message(t("dialog.ioErrorWrite", { file: tab.title }), {
        title: t("dialog.ioErrorTitle"),
        kind: "error",
      });
      return false;
    }
  }

  /** SPEC-CORE-006 / AT-017: diálogo nativo de Guardar como. */
  async saveAs(id: string): Promise<boolean> {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return false;

    const target = await saveDialog({
      filters: [{ name: appConfig.fileFilters.name, extensions: [...appConfig.fileFilters.extensions] }],
      defaultPath: tab.path ?? `${tab.title}.md`,
    });
    if (!target) return false;

    try {
      await invoke("write_text_file_atomic", { path: target, contents: tab.text });
      tab.path = target;
      tab.title = basename(target);
      tab.dirty = false;
      this.#touch();
      void this.#persistSession();
      return true;
    } catch {
      await message(t("dialog.ioErrorWrite", { file: basename(target) }), {
        title: t("dialog.ioErrorTitle"),
        kind: "error",
      });
      return false;
    }
  }

  /**
   * SPEC-CORE-019 / SEC-010: "Recargar" del diálogo de cambio externo (ver
   * file-watch.svelte.ts). Reemplaza el texto con el contenido en disco y
   * limpia dirty; `editorState` se descarta porque ya no corresponde al
   * nuevo texto (el editor lo reconstruye desde `text` al remontar).
   */
  async reloadFromDisk(id: string): Promise<void> {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab || !tab.path) return;
    try {
      const text = await invoke<string>("read_text_file", { path: tab.path });
      tab.text = text;
      tab.dirty = false;
      tab.editorState = null;
      tab.reloadNonce += 1;
      this.#touch();
    } catch {
      await message(t("dialog.ioErrorRead", { file: tab.title }), {
        title: t("dialog.ioErrorTitle"),
        kind: "error",
      });
    }
  }

  /**
   * SPEC-CORE-007 / AT-019/020: pregunta Guardar/No guardar/Cancelar solo
   * si está sucia. Devuelve si la pestaña efectivamente se cerró (para que
   * el cierre de ventana, BL-025, sepa si debe abortar).
   */
  async close(id: string): Promise<boolean> {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return true;

    if (tab.dirty) {
      // BUG-01 (hotfix/window-close-permission): con botones personalizados
      // ({yes,no,cancel}), tauri-plugin-dialog devuelve el TEXTO del botón
      // pulsado (rfd::MessageDialogResult::Custom(label)), nunca el string
      // fijo "Yes"/"No"/"Cancel" — comparar contra esos literales hacía que
      // "Cancelar" cerrara la pestaña igual (nunca coincidía con "Cancel") y
      // que "Guardar" descartara los cambios sin guardarlos (nunca coincidía
      // con "Yes"). Hay que comparar contra los labels reales.
      const saveLabel = t("dialog.save");
      const cancelLabel = t("dialog.cancel");
      const choice = await message(t("dialog.closeDirtyMessage", { file: tab.title }), {
        title: t("dialog.closeDirtyTitle"),
        kind: "warning",
        buttons: { yes: saveLabel, no: t("dialog.dontSave"), cancel: cancelLabel },
      });
      if (choice === cancelLabel) return false;
      if (choice === saveLabel) {
        const saved = await this.save(id);
        if (!saved) return false;
      }
    }

    this.#remove(id);
    void this.#persistSession();
    return true;
  }

  /** TAB-030: al cerrar la activa, se activa la vecina derecha o, si no, la izquierda. */
  #remove(id: string): void {
    const index = this.tabs.findIndex((tab) => tab.id === id);
    if (index === -1) return;

    const wasActive = this.activeId === id;
    this.tabs = this.tabs.toSpliced(index, 1);

    if (!wasActive) return;
    if (this.tabs.length === 0) {
      this.activeId = null;
      return;
    }
    const neighborIndex = Math.min(index, this.tabs.length - 1);
    this.activeId = this.tabs[neighborIndex].id;
  }

  /**
   * BL-025 / PD-08: al cerrar la ventana se pregunta por cada pestaña
   * sucia. Si se cancela cualquiera, se aborta el cierre completo.
   */
  async closeAllForWindowExit(): Promise<boolean> {
    return this.closeAll();
  }

  /** UI-SCREENS §5: menú contextual de pestaña — "Cerrar todas". */
  async closeAll(): Promise<boolean> {
    for (const tab of [...this.tabs]) {
      if (tab.kind !== "file") continue;
      const closed = await this.close(tab.id);
      if (!closed) return false;
    }
    return true;
  }

  /** UI-SCREENS §5: menú contextual de pestaña — "Cerrar otras". */
  async closeOthers(id: string): Promise<boolean> {
    for (const tab of [...this.tabs]) {
      if (tab.kind !== "file" || tab.id === id) continue;
      const closed = await this.close(tab.id);
      if (!closed) return false;
    }
    return true;
  }

  /** UI-SCREENS §5: menú contextual de pestaña — "Cerrar a la derecha". */
  async closeRight(id: string): Promise<boolean> {
    const index = this.tabs.findIndex((t) => t.id === id);
    if (index === -1) return true;
    for (const tab of this.tabs.slice(index + 1)) {
      if (tab.kind !== "file") continue;
      const closed = await this.close(tab.id);
      if (!closed) return false;
    }
    return true;
  }

  async #persistSession(): Promise<void> {
    const fileTabs = this.tabs.filter(
      (tab): tab is Tab & { path: string } => tab.kind === "file" && tab.path !== null,
    );
    const sessionTabs: SessionTab[] = fileTabs.map((tab) => ({
      path: tab.path,
      viewMode: tab.viewMode,
      scroll: tab.scroll,
    }));
    const activeIndex = Math.max(
      0,
      fileTabs.findIndex((tab) => tab.id === this.activeId),
    );
    await saveSession({ tabs: sessionTabs, activeIndex });
  }

  /** SPEC-CORE-016 / BL-026: se llama una vez al iniciar la app. */
  async restoreSession(): Promise<void> {
    if (this.sessionRestored) return;
    this.sessionRestored = true;

    const session = await loadSession();
    if (!session) return;

    // Lookups locales y efímeros, no estado reactivo — SvelteMap no aplica.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const viewModes = new Map(session.tabs.map((tab) => [tab.path, tab.viewMode]));
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const scrolls = new Map(session.tabs.map((tab) => [tab.path, tab.scroll]));
    await this.openPaths(
      session.tabs.map((tab) => tab.path),
      viewModes,
    );
    for (const tab of this.tabs) {
      if (tab.path && scrolls.has(tab.path)) tab.scroll = scrolls.get(tab.path) ?? 0;
    }
    this.#touch();
    const activeTab = this.tabs[session.activeIndex];
    if (activeTab) this.activeId = activeTab.id;
  }
}

export const tabsStore = new TabsStore();
