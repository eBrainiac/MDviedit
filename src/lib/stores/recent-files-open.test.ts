/**
 * Cobertura de AT-086/AT-089 (SPEC-CORE-021). Verifica en particular la
 * comparación del botón elegido contra el texto real del label — la misma
 * clase de bug que BUG-02 (tabs.svelte.ts/file-watch.ts): con botones
 * personalizados, tauri-plugin-dialog devuelve el texto del botón pulsado,
 * nunca un literal fijo como "Ok"/"Cancel".
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const dialogMocks = vi.hoisted(() => ({ message: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => dialogMocks);

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const tabsStoreMock = vi.hoisted(() => ({ openPaths: vi.fn() }));
vi.mock("./tabs.svelte", () => ({ tabsStore: tabsStoreMock }));

const recentFilesStoreMock = vi.hoisted(() => ({ remove: vi.fn() }));
vi.mock("./recent-files.svelte", () => ({ recentFilesStore: recentFilesStoreMock }));

const { openRecentFile } = await import("./recent-files-open");

describe("openRecentFile", () => {
  const entry = { path: "a.md", title: "a.md", lastAccessedAt: 0 };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ruta válida: activa/abre la pestaña y no muestra diálogo (AT-086)", async () => {
    invokeMock.mockResolvedValue(["a.md"]);
    const opened = await openRecentFile(entry);
    expect(opened).toBe(true);
    expect(tabsStoreMock.openPaths).toHaveBeenCalledWith(["a.md"]);
    expect(dialogMocks.message).not.toHaveBeenCalled();
  });

  it("ruta inexistente + elige quitar: la quita de la lista y no abre nada (AT-089)", async () => {
    invokeMock.mockResolvedValue([]);
    dialogMocks.message.mockResolvedValue("Quitar de la lista");
    const opened = await openRecentFile(entry);
    expect(opened).toBe(false);
    expect(recentFilesStoreMock.remove).toHaveBeenCalledWith("a.md");
    expect(tabsStoreMock.openPaths).not.toHaveBeenCalled();
  });

  it("ruta inexistente + cancela: no la quita ni abre nada (AT-089)", async () => {
    invokeMock.mockResolvedValue([]);
    dialogMocks.message.mockResolvedValue("Cancelar");
    const opened = await openRecentFile(entry);
    expect(opened).toBe(false);
    expect(recentFilesStoreMock.remove).not.toHaveBeenCalled();
    expect(tabsStoreMock.openPaths).not.toHaveBeenCalled();
  });
});
