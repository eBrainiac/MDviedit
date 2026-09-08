/**
 * BL-109 / ADR-010 / UI-SCREENS §8: envoltorio delgado sobre los comandos
 * Rust que leen/escriben `aiApiKey` en el almacén de credenciales del SO
 * (`src-tauri/src/ai_keychain.rs`, crate `keyring`) — nunca en
 * `tauri-plugin-store` (desviación explícita de ADR-006, ya autorizada en
 * ADR-010).
 */
import { invoke } from "@tauri-apps/api/core";

export async function getAiApiKey(): Promise<string | null> {
  return invoke<string | null>("ai_keychain_get_api_key");
}

export async function setAiApiKey(apiKey: string): Promise<void> {
  await invoke("ai_keychain_set_api_key", { apiKey });
}

export async function deleteAiApiKey(): Promise<void> {
  await invoke("ai_keychain_delete_api_key");
}
