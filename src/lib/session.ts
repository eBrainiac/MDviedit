/**
 * SPEC-CORE-016: al reabrir la app se restauran las pestañas que tenían
 * ruta (ruta + vista + scroll). Los borradores sin ruta nunca se
 * persisten (PD-09). Las rutas se revalidan con el comando Rust
 * `validate_existing_paths` (SEC-002) antes de intentar leerlas.
 */
import { Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { appConfig, type ViewMode } from "../config/app.config";

export interface SessionTab {
  readonly path: string;
  readonly viewMode: ViewMode;
  readonly scroll: number;
}

interface SessionData {
  readonly tabs: readonly SessionTab[];
  readonly activeIndex: number;
}

let store: Store | null = null;

async function getStore(): Promise<Store> {
  store ??= await Store.load(appConfig.store.sessionFile);
  return store;
}

export async function loadSession(): Promise<SessionData | null> {
  const s = await getStore();
  const tabs = (await s.get<SessionTab[]>("tabs")) ?? [];
  if (tabs.length === 0) return null;

  const validPaths = new Set(
    await invoke<string[]>("validate_existing_paths", { paths: tabs.map((tab) => tab.path) }),
  );
  const filtered = tabs.filter((tab) => validPaths.has(tab.path));
  if (filtered.length === 0) return null;

  const storedActiveIndex = (await s.get<number>("activeIndex")) ?? 0;
  const activeIndex = Math.min(Math.max(storedActiveIndex, 0), filtered.length - 1);
  return { tabs: filtered, activeIndex };
}

export async function saveSession(data: SessionData): Promise<void> {
  const s = await getStore();
  await s.set("tabs", data.tabs);
  await s.set("activeIndex", data.activeIndex);
  await s.save();
}
