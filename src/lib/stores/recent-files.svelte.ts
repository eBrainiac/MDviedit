/**
 * SPEC-CORE-021 (PD-53…56, BL-108): historial de "Recientes". Un solo
 * timestamp `lastAccessedAt` por ruta, actualizado al abrir un archivo y al
 * activar su pestaña (cubre abiertos y cerrados por igual) — el efecto que
 * llama a `touch()` vive en AppShell.svelte (mismo patrón que
 * `syncFileWatchers`, ver file-watch.ts). Persiste vía tauri-plugin-store
 * (ADR-006 capa 4), en un archivo propio (`recent-files.json`) separado de
 * preferences.json/session.json, mismo mecanismo que ambos.
 *
 * El historial guardado NO se recorta a `recentFilesLimit`: ese límite es
 * solo cuántos se MUESTRAN (`visible()`), no cuántos se recuerdan — AT-088
 * exige que bajar el límite y volver a subirlo no pierda entradas.
 */
import { Store } from "@tauri-apps/plugin-store";
import { appConfig } from "../../config/app.config";

export interface RecentFile {
  readonly path: string;
  readonly title: string;
  readonly lastAccessedAt: number;
}

function pathsEqual(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: "base" }) === 0;
}

export class RecentFilesStore {
  entries = $state<RecentFile[]>([]);

  #store: Store | null = null;
  #ready = false;

  async init(): Promise<void> {
    if (this.#ready) return;
    this.#ready = true;
    this.#store = await Store.load(appConfig.store.recentFilesFile);
    const stored = await this.#store.get<RecentFile[]>("entries");
    this.entries = Array.isArray(stored) ? stored : [];
  }

  async #persist(): Promise<void> {
    if (!this.#store) return;
    await this.#store.set("entries", this.entries);
    await this.#store.save();
  }

  /** SPEC-CORE-021/PD-53: llamar al abrir un archivo y al activar su pestaña. */
  touch(path: string, title: string): void {
    const rest = this.entries.filter((entry) => !pathsEqual(entry.path, path));
    this.entries = [{ path, title, lastAccessedAt: Date.now() }, ...rest];
    void this.#persist();
  }

  /** Botón "×" de un ítem — no borra el archivo ni cierra su pestaña. */
  remove(path: string): void {
    this.entries = this.entries.filter((entry) => !pathsEqual(entry.path, path));
    void this.#persist();
  }

  /** Enlace "Limpiar recientes". */
  clear(): void {
    this.entries = [];
    void this.#persist();
  }

  /** UI-SCREENS §1/§3/§4: hasta `limit`, orden `lastAccessedAt` descendente. */
  visible(limit: number): RecentFile[] {
    return [...this.entries].sort((a, b) => b.lastAccessedAt - a.lastAccessedAt).slice(0, limit);
  }
}

export const recentFilesStore = new RecentFilesStore();
