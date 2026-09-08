/**
 * SPEC-CORE-021/AT-086/AT-089: qué pasa al hacer clic en un ítem de
 * `RecentFilesList` (EmptyState o flyout del Dock). Separado de
 * `RecentFilesList.svelte` (mismo patrón que file-watch.ts: la lógica que
 * combina varios stores + diálogos nativos vive en un módulo aparte,
 * testeable sin un DOM real) porque compara el texto del botón elegido
 * contra un literal — exactamente la clase de bug de BUG-02
 * (tabs.svelte.ts/file-watch.ts) — y aquí sí puede cubrirse con un test.
 */
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { t } from "../../i18n";
import { tabsStore } from "./tabs.svelte";
import { recentFilesStore, type RecentFile } from "./recent-files.svelte";

/**
 * AT-086/PD-55: misma regla que el botón Abrir — ya abierto activa su
 * pestaña. AT-089: ruta ya inexistente -> Error de E/S con opción de
 * quitarla de la lista. Devuelve `true` solo si de verdad se
 * abrió/activó una pestaña (para que el flyout del Dock sepa si debe
 * cerrarse, ver RecentFilesList.svelte).
 */
export async function openRecentFile(entry: RecentFile): Promise<boolean> {
  const validPaths = await invoke<string[]>("validate_existing_paths", { paths: [entry.path] });
  if (!validPaths.includes(entry.path)) {
    const removeLabel = t("dialog.removeFromRecent");
    const choice = await message(t("dialog.ioErrorRead", { file: entry.title }), {
      title: t("dialog.ioErrorTitle"),
      kind: "error",
      buttons: { ok: removeLabel, cancel: t("dialog.cancel") },
    });
    if (choice === removeLabel) recentFilesStore.remove(entry.path);
    return false;
  }
  await tabsStore.openPaths([entry.path]);
  return true;
}
