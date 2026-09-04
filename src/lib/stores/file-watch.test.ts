/**
 * Cobertura de SPEC-CORE-019 / SEC-010 (BL-051): alta/baja de watchers según
 * las rutas abiertas y `watchFiles`, y el diálogo Recargar/Mantener.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const unwatchMocks = new Map<string, ReturnType<typeof vi.fn>>();
const watchMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-fs", () => ({ watch: watchMock }));

const dialogMocks = vi.hoisted(() => ({ message: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => dialogMocks);

// BUG-03: syncFileWatchers ahora otorga scope (allow_watch_path) antes de
// watch() — mockeado igual que en tabs.svelte.test.ts.
const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const tabsStoreMock = vi.hoisted(() => ({
  tabs: [] as { id: string; path: string | null; dirty: boolean }[],
  reloadFromDisk: vi.fn(),
}));
vi.mock("./tabs.svelte", () => ({ tabsStore: tabsStoreMock }));

const { syncFileWatchers, resetFileWatchersForTest } = await import("./file-watch");

describe("syncFileWatchers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unwatchMocks.clear();
    tabsStoreMock.tabs = [];
    invokeMock.mockResolvedValue(undefined);
    watchMock.mockImplementation(async (path: string) => {
      const unwatch = vi.fn();
      unwatchMocks.set(path, unwatch);
      return unwatch;
    });
  });

  it("da de alta un watcher por cada ruta abierta cuando watchFiles está activo", async () => {
    await syncFileWatchers(["a.md", "b.md"], true);

    expect(watchMock).toHaveBeenCalledTimes(2);
    expect(watchMock).toHaveBeenCalledWith("a.md", expect.any(Function), { delayMs: expect.any(Number) });

    resetFileWatchersForTest();
  });

  it("no da de alta ningún watcher cuando watchFiles está desactivado", async () => {
    await syncFileWatchers(["a.md"], false);

    expect(watchMock).not.toHaveBeenCalled();
  });

  it("da de baja los watchers de rutas que ya no están abiertas", async () => {
    await syncFileWatchers(["a.md", "b.md"], true);
    const unwatchA = unwatchMocks.get("a.md");

    await syncFileWatchers(["b.md"], true);

    expect(unwatchA).toHaveBeenCalledOnce();
    resetFileWatchersForTest();
  });

  it("da de baja todos los watchers cuando watchFiles se desactiva", async () => {
    await syncFileWatchers(["a.md"], true);
    const unwatchA = unwatchMocks.get("a.md");

    await syncFileWatchers(["a.md"], false);

    expect(unwatchA).toHaveBeenCalledOnce();
    resetFileWatchersForTest();
  });

  it("no vuelve a llamar watch() para una ruta ya vigilada", async () => {
    await syncFileWatchers(["a.md"], true);
    await syncFileWatchers(["a.md"], true);

    expect(watchMock).toHaveBeenCalledTimes(1);
    resetFileWatchersForTest();
  });

  it("SEC-010: el cambio detectado solo dispara el diálogo, nunca recarga sin confirmar", async () => {
    tabsStoreMock.tabs = [{ id: "t1", path: "a.md", dirty: false }];
    dialogMocks.message.mockResolvedValue("Mantener");
    let onChange: (() => void) | undefined;
    watchMock.mockImplementation(async (_path: string, cb: () => void) => {
      onChange = cb;
      return vi.fn();
    });

    await syncFileWatchers(["a.md"], true);
    onChange?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(dialogMocks.message).toHaveBeenCalledOnce();
    expect(tabsStoreMock.reloadFromDisk).not.toHaveBeenCalled();
    resetFileWatchersForTest();
  });

  it("elegir Recargar llama a tabsStore.reloadFromDisk", async () => {
    tabsStoreMock.tabs = [{ id: "t1", path: "a.md", dirty: false }];
    dialogMocks.message.mockResolvedValue("Recargar");
    let onChange: (() => void) | undefined;
    watchMock.mockImplementation(async (_path: string, cb: () => void) => {
      onChange = cb;
      return vi.fn();
    });

    await syncFileWatchers(["a.md"], true);
    onChange?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(tabsStoreMock.reloadFromDisk).toHaveBeenCalledWith("t1");
    resetFileWatchersForTest();
  });

  it("BUG-03: otorga scope (allow_watch_path) antes de watch()", async () => {
    await syncFileWatchers(["a.md"], true);

    expect(invokeMock).toHaveBeenCalledWith("allow_watch_path", { path: "a.md" });
    resetFileWatchersForTest();
  });

  it("BUG-03: un rechazo de scope en watch() se registra en consola, no se traga en silencio", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    watchMock.mockRejectedValue(new Error("forbidden path: a.md"));

    await syncFileWatchers(["a.md"], true);

    expect(consoleError).toHaveBeenCalledWith("No se pudo vigilar el archivo:", "a.md", expect.any(Error));
    consoleError.mockRestore();
    resetFileWatchersForTest();
  });
});
