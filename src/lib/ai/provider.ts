/**
 * BL-113/114/115 / SPEC-CORE-022: despacha un turno de conversación al
 * backend activo (BYOK o local). Toda la red vive en Rust — este módulo solo
 * arma el payload y llama a `invoke` (ver nota de arquitectura de red en
 * `src-tauri/src/lib.rs`, BL-116).
 */
import { invoke } from "@tauri-apps/api/core";
import { preferences } from "../stores/preferences.svelte";
import { getAiApiKey } from "../stores/ai-keychain";
import { aiModelStore } from "../stores/ai-model.svelte";
import { appConfig, type AiBackend, type AiProvider } from "../../config/app.config";

export interface AiChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

/** PD-77/78: solo Anthropic habla su esquema nativo aparte — cualquier otro
 * preset (incl. "custom") habla el esquema OpenAI-compatible genérico,
 * distinguido en la práctica solo por `aiBaseUrl`. */
function byokScheme(provider: Exclude<AiProvider, "none">): "openai" | "anthropic" {
  return provider === "anthropic" ? "anthropic" : "openai";
}

async function sendToByok(messages: readonly AiChatMessage[]): Promise<string> {
  if (preferences.aiProvider === "none") {
    throw new Error("Selecciona un proveedor BYOK en Preferencias → IA");
  }
  if (!preferences.aiBaseUrl) {
    throw new Error("Falta configurar la URL base del proveedor en Preferencias → IA");
  }
  if (!preferences.aiModelId) {
    throw new Error("Falta configurar el modelo en Preferencias → IA");
  }
  const apiKey = await getAiApiKey();
  if (!apiKey) {
    throw new Error("Falta configurar la clave de API en Preferencias → IA");
  }
  return invoke<string>("ai_byok_send_message", {
    req: {
      provider: byokScheme(preferences.aiProvider),
      baseUrl: preferences.aiBaseUrl,
      model: preferences.aiModelId,
      apiKey,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      timeoutMs: appConfig.behavior.aiByokTimeoutMs,
      maxResponseBytes: appConfig.behavior.aiByokMaxResponseBytes,
    },
  });
}

async function sendToLocal(messages: readonly AiChatMessage[]): Promise<string> {
  const ready = await aiModelStore.ensureLoaded();
  if (!ready) {
    throw new Error(aiModelStore.error ?? "El modelo local no está disponible");
  }
  return invoke<string>("ai_local_generate", {
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
}

export async function sendToBackend(backend: AiBackend, messages: readonly AiChatMessage[]): Promise<string> {
  return backend === "local" ? sendToLocal(messages) : sendToByok(messages);
}
