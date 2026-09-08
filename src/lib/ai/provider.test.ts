// @vitest-environment jsdom
/**
 * BL-119/120 (IT-10): cobertura del despacho BYOK genérico — qué esquema de
 * API se manda a Rust por preset (PD-77/78) y los mismos guardas de
 * configuración incompleta que ya cubría IT-9 (proveedor/URL/modelo/clave).
 * `invoke`/`ai-keychain` mockeados, igual que `ai-model.svelte.test.ts`.
 * jsdom porque `preferences.resetToDefaults()` toca `document` de paso
 * (ver `preferences.ai.svelte.test.ts`).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const getAiApiKeyMock = vi.hoisted(() => vi.fn());
vi.mock("../stores/ai-keychain", () => ({ getAiApiKey: getAiApiKeyMock }));

const { preferences } = await import("../stores/preferences.svelte");
const { sendToBackend } = await import("./provider");

describe("sendToBackend — byok", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferences.resetToDefaults();
    getAiApiKeyMock.mockResolvedValue("sk-test");
    invokeMock.mockResolvedValue("respuesta");
  });

  it("sin proveedor configurado, rechaza antes de invocar", async () => {
    await expect(sendToBackend("byok", [{ role: "user", content: "hola" }])).rejects.toThrow(/proveedor BYOK/);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("sin aiModelId configurado, rechaza antes de invocar (PD-77)", async () => {
    preferences.setAiProvider("groq");
    await expect(sendToBackend("byok", [{ role: "user", content: "hola" }])).rejects.toThrow(/modelo/);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("sin clave de API, rechaza antes de invocar", async () => {
    preferences.setAiProvider("openai");
    preferences.setAiModelId("gpt-4o-mini");
    getAiApiKeyMock.mockResolvedValue(null);
    await expect(sendToBackend("byok", [{ role: "user", content: "hola" }])).rejects.toThrow(/clave de API/);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("preset OpenRouter manda esquema \"openai\" con su propia baseUrl (PD-77/78)", async () => {
    preferences.setAiProvider("openrouter");
    preferences.setAiModelId("some/model");
    await sendToBackend("byok", [{ role: "user", content: "hola" }]);
    expect(invokeMock).toHaveBeenCalledWith(
      "ai_byok_send_message",
      expect.objectContaining({
        req: expect.objectContaining({
          provider: "openai",
          baseUrl: "https://openrouter.ai/api/v1",
          model: "some/model",
          apiKey: "sk-test",
        }),
      }),
    );
  });

  it("preset Anthropic manda esquema \"anthropic\" (PD-78)", async () => {
    preferences.setAiProvider("anthropic");
    preferences.setAiModelId("claude-3-5-haiku-20241022");
    await sendToBackend("byok", [{ role: "user", content: "hola" }]);
    expect(invokeMock).toHaveBeenCalledWith(
      "ai_byok_send_message",
      expect.objectContaining({ req: expect.objectContaining({ provider: "anthropic" }) }),
    );
  });

  it("preset personalizado usa la aiBaseUrl que el usuario haya guardado", async () => {
    preferences.setAiProvider("custom");
    preferences.setAiBaseUrl("https://mi-endpoint.example/v1");
    preferences.setAiModelId("mi-modelo");
    await sendToBackend("byok", [{ role: "user", content: "hola" }]);
    expect(invokeMock).toHaveBeenCalledWith(
      "ai_byok_send_message",
      expect.objectContaining({
        req: expect.objectContaining({ provider: "openai", baseUrl: "https://mi-endpoint.example/v1" }),
      }),
    );
  });
});
