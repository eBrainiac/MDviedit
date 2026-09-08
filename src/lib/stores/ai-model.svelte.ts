/**
 * BL-110/111/112 / SPEC-CORE-022 / PD-61/62/65 / AT-095/108/109: ciclo de
 * vida del modelo local — descarga bajo demanda (con progreso real y
 * cancelación), carga/descarga de RAM. La orquestación de comandos Tauri +
 * eventos vive aquí, separada de `AIChatPanel.svelte` (mismo criterio que
 * `file-watch.ts`): testable sin DOM mockeando `@tauri-apps/api/*`.
 *
 * `llama-cpp-2` está enlazado de verdad (ver reporte de cierre de la
 * continuación de IT-9 / src-tauri/src/ai_local.rs): `ai_local_model_load`
 * carga el modelo real en RAM y `ai_local_generate` ejecuta inferencia real.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { appDataDir, join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { appConfig } from "../../config/app.config";

export interface AiDownloadProgress {
  readonly downloadedBytes: number;
  readonly totalBytes: number;
  readonly fraction: number;
}

interface LocalModelStatus {
  readonly loaded: boolean;
  readonly engineAvailable: boolean;
}

export type LocalModelPhase = "idle" | "downloading" | "loaded" | "error";

class AiModelStore {
  phase = $state<LocalModelPhase>("idle");
  progress = $state<AiDownloadProgress | null>(null);
  error = $state<string | null>(null);
  engineAvailable = $state(false);

  #modelPathPromise: Promise<string> | null = null;
  #unlistenProgress: UnlistenFn | null = null;
  #loadPromise: Promise<boolean> | null = null;

  async #modelPath(): Promise<string> {
    if (!this.#modelPathPromise) {
      this.#modelPathPromise = (async () => {
        const dir = await appDataDir();
        return join(dir, "models", appConfig.ai.localModelFileName);
      })();
    }
    return this.#modelPathPromise;
  }

  /** AT-095: descarga (si hace falta) y carga el modelo. Idempotente — una
   * llamada concurrente reutiliza la misma promesa en vez de disparar dos
   * descargas a la vez. */
  async ensureLoaded(): Promise<boolean> {
    if (this.phase === "loaded") return true;
    if (!this.#loadPromise) {
      this.#loadPromise = this.#doEnsureLoaded().finally(() => {
        this.#loadPromise = null;
      });
    }
    return this.#loadPromise;
  }

  async #doEnsureLoaded(): Promise<boolean> {
    this.error = null;
    try {
      const path = await this.#modelPath();
      const alreadyDownloaded = await exists(path);
      if (!alreadyDownloaded) {
        const downloaded = await this.#downloadModel(path);
        if (!downloaded) return false;
      }
      const status = await invoke<LocalModelStatus>("ai_local_model_load", { modelPath: path });
      this.phase = "loaded";
      this.engineAvailable = status.engineAvailable;
      return true;
    } catch (err) {
      this.error = String(err);
      this.phase = "error";
      return false;
    }
  }

  async #downloadModel(destPath: string): Promise<boolean> {
    this.phase = "downloading";
    this.progress = { downloadedBytes: 0, totalBytes: appConfig.ai.localModelSizeBytesApprox, fraction: 0 };
    this.#unlistenProgress = await listen<AiDownloadProgress>("ai-model-download-progress", (event) => {
      this.progress = event.payload;
    });
    try {
      await invoke("ai_model_download_start", {
        url: appConfig.ai.localModelDownloadUrl,
        destPath,
        expectedSha256: appConfig.ai.localModelSha256,
      });
      return true;
    } catch (err) {
      this.error = String(err);
      this.phase = "error";
      return false;
    } finally {
      this.#unlistenProgress?.();
      this.#unlistenProgress = null;
      this.progress = null;
    }
  }

  cancelDownload(): void {
    invoke("ai_model_download_cancel").catch(() => {
      // Best-effort: si la cancelación falla a nivel de transporte IPC, el
      // propio flujo de descarga ya reporta su error por su cuenta.
    });
  }

  /** PD-65 / AT-109: se llama al desactivar el Chat — suelta la RAM de
   * verdad, no solo oculta el panel del frontend (eso lo decide AppShell). */
  async unload(): Promise<void> {
    if (this.phase !== "loaded") return;
    try {
      await invoke("ai_local_model_unload");
    } catch {
      // La RAM se considera liberada del lado de la app aunque el comando
      // falle a nivel de transporte IPC — el estado "cargado" no debe
      // sobrevivir a un intento de apagado (PD-65).
    } finally {
      this.phase = "idle";
      this.engineAvailable = false;
    }
  }
}

export const aiModelStore = new AiModelStore();
