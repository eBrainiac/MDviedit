// @vitest-environment jsdom
/**
 * BL-119/120 (IT-10, ADR-010 actualización PD-77…83): cobertura de la
 * generalización BYOK en `preferences.svelte.ts` — precarga de `aiBaseUrl`
 * por preset y el rechazo AI-SEC-001 al guardar una URL no-`https://`.
 * No requiere mockear `@tauri-apps/plugin-store`: sin `init()`, `#persist`
 * no-opea (mismo patrón ya usado por el resto de la suite para código que
 * no depende del puente IPC real). jsdom porque `resetToDefaults()` también
 * toca `setThemeMode`/`setPalette`/`setLocale`, que sí tocan `document`.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { appConfig } from "../../config/app.config";
import { preferences } from "./preferences.svelte";

describe("PreferencesStore — BYOK genérico (AI-SEC-001, PD-83)", () => {
  beforeEach(() => {
    preferences.resetToDefaults();
  });

  it("empieza sin proveedor ni URL configurados", () => {
    expect(preferences.aiProvider).toBe("none");
    expect(preferences.aiBaseUrl).toBe("");
    expect(preferences.aiModelId).toBe("");
  });

  it("elegir un preset con URL fija precarga aiBaseUrl (PD-83)", () => {
    preferences.setAiProvider("groq");
    expect(preferences.aiBaseUrl).toBe(appConfig.ai.presetBaseUrls.groq);

    preferences.setAiProvider("openrouter");
    expect(preferences.aiBaseUrl).toBe(appConfig.ai.presetBaseUrls.openrouter);
  });

  it("elegir \"custom\" deja aiBaseUrl como estaba (PD-83)", () => {
    preferences.setAiProvider("groq");
    preferences.setAiProvider("custom");
    expect(preferences.aiBaseUrl).toBe(appConfig.ai.presetBaseUrls.groq);
  });

  it("elegir \"none\" deja aiBaseUrl como estaba", () => {
    preferences.setAiProvider("groq");
    preferences.setAiProvider("none");
    expect(preferences.aiBaseUrl).toBe(appConfig.ai.presetBaseUrls.groq);
  });

  it("AI-SEC-001: rechaza una URL http:// y no cambia el valor activo", () => {
    preferences.setAiProvider("custom");
    const applied = preferences.setAiBaseUrl("http://inseguro.example");
    expect(applied).toBe(false);
    expect(preferences.aiBaseUrl).toBe("");
  });

  it("AI-SEC-001: acepta https:// y persiste el nuevo valor", () => {
    const applied = preferences.setAiBaseUrl("https://mi-endpoint.example/v1");
    expect(applied).toBe(true);
    expect(preferences.aiBaseUrl).toBe("https://mi-endpoint.example/v1");
  });

  it("setAiModelId guarda el id de modelo en texto libre", () => {
    preferences.setAiModelId("openrouter/some-model");
    expect(preferences.aiModelId).toBe("openrouter/some-model");
  });

  it("resetToDefaults limpia proveedor, URL y modelo", () => {
    preferences.setAiProvider("groq");
    preferences.setAiModelId("llama-3.3-70b");
    preferences.resetToDefaults();
    expect(preferences.aiProvider).toBe("none");
    expect(preferences.aiBaseUrl).toBe("");
    expect(preferences.aiModelId).toBe("");
  });
});
