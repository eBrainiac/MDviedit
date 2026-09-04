/**
 * SPEC-CORE-019 / SEC-010: vigila cada pestaña de archivo abierta (mientras
 * `preferences.watchFiles` esté activo) con `fs watch` + debounce
 * (`fileWatchDebounceMs`). Al detectar un cambio, muestra el diálogo nativo
 * Recargar/Mantener — nunca recarga sin confirmar (SEC-010).
 *
 * No es una clase con `$state`: el mapa de watchers activos es contable
 * interno, no algo que ningún componente necesite leer reactivamente. La
 * sincronización con las pestañas abiertas la dispara un `$effect` en
 * AppShell.svelte (los `$effect` solo pueden vivir dentro de un árbol de
 * componente montado) llamando a `syncFileWatchers` en cada cambio.
 */
import { watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { message } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { appConfig } from "../../config/app.config";
import { t } from "../../i18n";
import { tabsStore } from "./tabs.svelte";

const activeWatchers = new Map<string, UnwatchFn>();

async function handleFileChanged(path: string): Promise<void> {
  const tab = tabsStore.tabs.find((t2) => t2.path === path);
  if (!tab) return;

  // BUG-01/BUG-02 (hotfix/window-close-permission): con botones personalizados
  // ({ok,cancel}/{yes,no,cancel}), tauri-plugin-dialog devuelve el TEXTO del
  // botón pulsado (rfd::MessageDialogResult::Custom(label)), nunca el string
  // fijo "Ok"/"Yes"/"Cancel" — hay que comparar contra el label real.
  const reloadLabel = t("dialog.reload");
  const choice = await message(t(tab.dirty ? "dialog.fileChangedDirtyMessage" : "dialog.fileChangedMessage"), {
    title: t("preferences.tabTitle"),
    kind: "warning",
    buttons: { ok: reloadLabel, cancel: t("dialog.keep") },
  });
  if (choice === reloadLabel) await tabsStore.reloadFromDisk(tab.id);
}

/**
 * Llamar desde un `$effect` que dependa de las rutas abiertas y de
 * `preferences.watchFiles`. Da de baja los watchers que ya no aplican y da
 * de alta los que faltan; es idempotente, así que se puede llamar en cada
 * cambio sin llevar cuenta de qué cambió.
 */
export async function syncFileWatchers(openPaths: readonly string[], enabled: boolean): Promise<void> {
  for (const [path, unwatch] of activeWatchers) {
    if (!enabled || !openPaths.includes(path)) {
      unwatch();
      activeWatchers.delete(path);
    }
  }
  if (!enabled) return;

  for (const path of openPaths) {
    if (activeWatchers.has(path)) continue;
    // Reserva el slot antes del `await`: si dos llamadas se solapan para la
    // misma ruta (dos cambios de pestañas seguidos), la segunda no debe
    // volver a intentar `watch()` mientras la primera todavía está en vuelo.
    activeWatchers.set(path, () => {});
    try {
      // BUG-03: `fs:allow-watch` (capabilities/main.json) habilita el
      // comando `watch()` "sin ningún scope preconfigurado" — sin otorgar
      // scope dinámico primero, watch() se rechaza por scope en cualquier
      // ruta fuera de fs:scope-appconfig. Igual que allow_asset_folder para
      // el protocolo asset: (SEC-006), no persiste entre reinicios (SEC-002),
      // así que se vuelve a otorgar en cada síncronización.
      await invoke("allow_watch_path", { path });
      const unwatch = await watch(path, () => void handleFileChanged(path), {
        delayMs: appConfig.behavior.fileWatchDebounceMs,
      });
      activeWatchers.set(path, unwatch);
    } catch (err) {
      // SEC-010 exige nunca recargar sin confirmar, pero silenciar el error
      // por completo dificulta detectar que la vigilancia dejó de funcionar
      // (BUG-03) — se registra aunque la UI no muestre nada.
      console.error("No se pudo vigilar el archivo:", path, err);
      activeWatchers.delete(path);
    }
  }
}

/** Solo para tests: limpia el estado del módulo entre casos. */
export function resetFileWatchersForTest(): void {
  for (const unwatch of activeWatchers.values()) unwatch();
  activeWatchers.clear();
}
