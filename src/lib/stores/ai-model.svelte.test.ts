/**
 * BL-110/111/112 / PD-65 / AT-095/109. Cubre la orquestación (descarga solo
 * si hace falta, carga, apagado real) sin red real ni un .gguf de verdad —
 * `invoke`/`listen`/`exists` están mockeados.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const listenMock = vi.hoisted(() => vi.fn(async () => vi.fn()));
vi.mock("@tauri-apps/api/event", () => ({ listen: listenMock }));

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: vi.fn(async () => "C:/appdata"),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));

const existsMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-fs", () => ({ exists: existsMock }));

const { aiModelStore } = await import("./ai-model.svelte");

describe("aiModelStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiModelStore.phase = "idle";
    aiModelStore.error = null;
    aiModelStore.progress = null;
  });

  it("already downloaded: loads directly without starting a download", async () => {
    existsMock.mockResolvedValue(true);
    invokeMock.mockResolvedValue({ loaded: true, engineAvailable: false });
    const ok = await aiModelStore.ensureLoaded();
    expect(ok).toBe(true);
    expect(aiModelStore.phase).toBe("loaded");
    expect(invokeMock).not.toHaveBeenCalledWith("ai_model_download_start", expect.anything());
    expect(invokeMock).toHaveBeenCalledWith("ai_local_model_load", expect.objectContaining({}));
  });

  it("not downloaded yet: downloads first, then loads (AT-095)", async () => {
    existsMock.mockResolvedValue(false);
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "ai_model_download_start") return undefined;
      if (cmd === "ai_local_model_load") return { loaded: true, engineAvailable: false };
      throw new Error(`unexpected invoke: ${cmd}`);
    });
    const ok = await aiModelStore.ensureLoaded();
    expect(ok).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith("ai_model_download_start", expect.anything());
    expect(invokeMock).toHaveBeenCalledWith("ai_local_model_load", expect.anything());
  });

  it("a rejection while resolving the model path (appDataDir/exists) is caught, not left as an unhandled rejection", async () => {
    existsMock.mockRejectedValue(new Error("sin puente IPC real"));
    const ok = await aiModelStore.ensureLoaded();
    expect(ok).toBe(false);
    expect(aiModelStore.phase).toBe("error");
    expect(aiModelStore.error).toContain("sin puente IPC real");
  });

  it("a failed download surfaces the error and does not attempt to load", async () => {
    existsMock.mockResolvedValue(false);
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "ai_model_download_start") throw new Error("red caída");
      throw new Error(`unexpected invoke: ${cmd}`);
    });
    const ok = await aiModelStore.ensureLoaded();
    expect(ok).toBe(false);
    expect(aiModelStore.phase).toBe("error");
    expect(aiModelStore.error).toContain("red caída");
    expect(invokeMock).not.toHaveBeenCalledWith("ai_local_model_load", expect.anything());
  });

  it("unload calls the real backend command and resets phase to idle (AT-109)", async () => {
    existsMock.mockResolvedValue(true);
    invokeMock.mockResolvedValue({ loaded: true, engineAvailable: false });
    await aiModelStore.ensureLoaded();
    expect(aiModelStore.phase).toBe("loaded");

    await aiModelStore.unload();
    expect(invokeMock).toHaveBeenCalledWith("ai_local_model_unload");
    expect(aiModelStore.phase).toBe("idle");
  });

  it("unload is a no-op when nothing was loaded", async () => {
    await aiModelStore.unload();
    expect(invokeMock).not.toHaveBeenCalledWith("ai_local_model_unload");
  });
});
