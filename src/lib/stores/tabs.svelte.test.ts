/**
 * Cobertura automática de AT-010…012, AT-017…021 y TAB-030 (BL-020…025).
 * `@tauri-apps/plugin-dialog`, `@tauri-apps/api/core` y `../session` se
 * mockean porque no hay puente IPC de Tauri fuera de la app empaquetada.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const dialogMocks = vi.hoisted(() => ({
  open: vi.fn(),
  save: vi.fn(),
  message: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-dialog", () => dialogMocks);

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const sessionMocks = vi.hoisted(() => ({
  loadSession: vi.fn(async () => null),
  saveSession: vi.fn(async () => undefined),
}));
vi.mock("../session", () => sessionMocks);

const { TabsStore } = await import("./tabs.svelte");

describe("TabsStore", () => {
  let store: InstanceType<typeof TabsStore>;

  beforeEach(() => {
    store = new TabsStore();
    vi.clearAllMocks();
    invokeMock.mockResolvedValue(undefined);
  });

  it("newTab crea 'Sin título 1' activa, limpia y con foco (AT-010)", () => {
    store.newTab();
    expect(store.tabs).toHaveLength(1);
    expect(store.active?.title).toBe("Sin título 1");
    expect(store.active?.dirty).toBe(false);
    expect(store.active?.focusOnMount).toBe(true);
  });

  it("openPaths lee el contenido de cada ruta y activa la última (AT-011)", async () => {
    invokeMock.mockImplementation(async (cmd: string, args: { path: string }) =>
      cmd === "read_text_file" ? `contenido de ${args.path}` : undefined,
    );
    await store.openPaths(["a.md", "b.md", "c.md"]);
    expect(store.tabs).toHaveLength(3);
    expect(store.active?.title).toBe("c.md");
    expect(store.tabs[0].text).toBe("contenido de a.md");
  });

  it("abrir una ruta ya abierta activa la existente sin duplicar (AT-012)", async () => {
    invokeMock.mockResolvedValue("contenido");
    await store.openPaths(["a.md"]);
    await store.openPaths(["b.md"]);
    await store.openPaths(["a.md"]);
    expect(store.tabs).toHaveLength(2);
    expect(store.active?.path).toBe("a.md");
  });

  it("guardar una pestaña nueva sin ruta delega a Guardar como (AT-017)", async () => {
    dialogMocks.save.mockResolvedValue("nuevo.md");
    store.newTab();
    const tab = store.active;
    if (!tab) throw new Error("sin pestaña activa");
    store.setContent(tab.id, "hola");

    const saved = await store.save(tab.id);

    expect(saved).toBe(true);
    expect(dialogMocks.save).toHaveBeenCalledOnce();
    expect(invokeMock).toHaveBeenCalledWith("write_text_file_atomic", { path: "nuevo.md", contents: "hola" });
    expect(tab.dirty).toBe(false);
    expect(tab.path).toBe("nuevo.md");
  });

  it("guardar como cancelado dentro de un save deja la pestaña sin guardar", async () => {
    dialogMocks.save.mockResolvedValue(null);
    store.newTab();
    const tab = store.active;
    if (!tab) throw new Error("sin pestaña activa");
    store.setContent(tab.id, "hola");

    const saved = await store.save(tab.id);

    expect(saved).toBe(false);
    expect(tab.dirty).toBe(true);
    expect(invokeMock).not.toHaveBeenCalledWith("write_text_file_atomic", expect.anything());
  });

  it("guardar una pestaña existente sobrescribe sin diálogo (AT-018)", async () => {
    invokeMock.mockImplementation(async (cmd: string) => (cmd === "read_text_file" ? "original" : undefined));
    await store.openPaths(["existing.md"]);
    const tab = store.active;
    if (!tab) throw new Error("sin pestaña activa");
    store.setContent(tab.id, "editado");

    const saved = await store.save(tab.id);

    expect(saved).toBe(true);
    expect(dialogMocks.save).not.toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith("write_text_file_atomic", {
      path: "existing.md",
      contents: "editado",
    });
    expect(tab.dirty).toBe(false);
  });

  it("cerrar una pestaña sucia y Cancelar la deja abierta (AT-019)", async () => {
    invokeMock.mockImplementation(async (cmd: string) => (cmd === "read_text_file" ? "original" : undefined));
    await store.openPaths(["a.md"]);
    const tab = store.active;
    if (!tab) throw new Error("sin pestaña activa");
    store.setContent(tab.id, "cambio");
    dialogMocks.message.mockResolvedValue("Cancelar");

    const closed = await store.close(tab.id);

    expect(closed).toBe(false);
    expect(store.tabs).toHaveLength(1);
  });

  it("cerrar una pestaña sucia con 'No guardar' cierra sin escribir (AT-019)", async () => {
    invokeMock.mockImplementation(async (cmd: string) => (cmd === "read_text_file" ? "original" : undefined));
    await store.openPaths(["a.md"]);
    const tab = store.active;
    if (!tab) throw new Error("sin pestaña activa");
    store.setContent(tab.id, "cambio");
    dialogMocks.message.mockResolvedValue("No guardar");

    const closed = await store.close(tab.id);

    expect(closed).toBe(true);
    expect(store.tabs).toHaveLength(0);
    expect(invokeMock).not.toHaveBeenCalledWith("write_text_file_atomic", expect.anything());
  });

  it("cerrar una pestaña sucia con 'Guardar' escribe y cierra (AT-019)", async () => {
    invokeMock.mockImplementation(async (cmd: string) => (cmd === "read_text_file" ? "original" : undefined));
    await store.openPaths(["a.md"]);
    const tab = store.active;
    if (!tab) throw new Error("sin pestaña activa");
    store.setContent(tab.id, "cambio");
    dialogMocks.message.mockResolvedValue("Guardar");

    const closed = await store.close(tab.id);

    expect(closed).toBe(true);
    expect(store.tabs).toHaveLength(0);
    expect(invokeMock).toHaveBeenCalledWith("write_text_file_atomic", { path: "a.md", contents: "cambio" });
  });

  it("cerrar una pestaña limpia no pregunta (AT-020)", async () => {
    invokeMock.mockResolvedValue("original");
    await store.openPaths(["a.md"]);
    const tab = store.active;
    if (!tab) throw new Error("sin pestaña activa");

    const closed = await store.close(tab.id);

    expect(closed).toBe(true);
    expect(dialogMocks.message).not.toHaveBeenCalled();
  });

  it("cerrar ventana con 2 pestañas sucias pregunta por cada una; cancelar aborta (AT-021)", async () => {
    invokeMock.mockImplementation(async (cmd: string) => (cmd === "read_text_file" ? "x" : undefined));
    await store.openPaths(["a.md"]);
    await store.openPaths(["b.md"]);
    store.setContent(store.tabs[0].id, "dirty a");
    store.setContent(store.tabs[1].id, "dirty b");
    dialogMocks.message.mockResolvedValueOnce("No guardar").mockResolvedValueOnce("Cancelar");

    const canClose = await store.closeAllForWindowExit();

    expect(canClose).toBe(false);
    expect(dialogMocks.message).toHaveBeenCalledTimes(2);
    // a.md ya se cerró (eligió "No guardar") antes de cancelar en b.md.
    expect(store.tabs).toHaveLength(1);
    expect(store.tabs[0].path).toBe("b.md");
  });

  it("cerrar ventana sin cancelar cierra todas las pestañas sucias (AT-021)", async () => {
    invokeMock.mockImplementation(async (cmd: string) => (cmd === "read_text_file" ? "x" : undefined));
    await store.openPaths(["a.md"]);
    await store.openPaths(["b.md"]);
    store.setContent(store.tabs[0].id, "dirty a");
    store.setContent(store.tabs[1].id, "dirty b");
    dialogMocks.message.mockResolvedValue("No guardar");

    const canClose = await store.closeAllForWindowExit();

    expect(canClose).toBe(true);
    expect(store.tabs).toHaveLength(0);
  });

  it("TAB-030: cerrar la pestaña activa activa la vecina derecha", async () => {
    invokeMock.mockResolvedValue("x");
    await store.openPaths(["a.md"]);
    await store.openPaths(["b.md"]);
    await store.openPaths(["c.md"]);
    store.activate(store.tabs[1].id);

    await store.close(store.tabs[1].id);

    expect(store.active?.path).toBe("c.md");
  });

  it("TAB-011: setWidth guarda el ancho de la pestaña indicada", () => {
    store.newTab();
    const tab = store.active;
    if (!tab) throw new Error("sin pestaña activa");

    store.setWidth(tab.id, 220);

    expect(tab.width).toBe(220);
  });

  it("IN-025: reorder mueve la pestaña a la posición indicada", async () => {
    invokeMock.mockResolvedValue("x");
    await store.openPaths(["a.md"]);
    await store.openPaths(["b.md"]);
    await store.openPaths(["c.md"]);
    const [a] = store.tabs;

    store.reorder(a.id, 2);

    expect(store.tabs.map((t) => t.path)).toEqual(["b.md", "c.md", "a.md"]);
  });

  it("reorder con un id inexistente no hace nada", async () => {
    invokeMock.mockResolvedValue("x");
    await store.openPaths(["a.md"]);
    await store.openPaths(["b.md"]);
    const before = store.tabs.map((t) => t.path);

    store.reorder("no-existe", 0);

    expect(store.tabs.map((t) => t.path)).toEqual(before);
  });

  it("UI-SCREENS §5: closeOthers cierra todas menos la indicada", async () => {
    invokeMock.mockResolvedValue("x");
    await store.openPaths(["a.md"]);
    await store.openPaths(["b.md"]);
    await store.openPaths(["c.md"]);
    dialogMocks.message.mockResolvedValue("No guardar");
    const keep = store.tabs[1];

    const ok = await store.closeOthers(keep.id);

    expect(ok).toBe(true);
    expect(store.tabs).toHaveLength(1);
    expect(store.tabs[0].id).toBe(keep.id);
  });

  it("UI-SCREENS §5: closeRight cierra solo las pestañas a la derecha", async () => {
    invokeMock.mockResolvedValue("x");
    await store.openPaths(["a.md"]);
    await store.openPaths(["b.md"]);
    await store.openPaths(["c.md"]);
    dialogMocks.message.mockResolvedValue("No guardar");

    const ok = await store.closeRight(store.tabs[0].id);

    expect(ok).toBe(true);
    expect(store.tabs.map((t) => t.path)).toEqual(["a.md"]);
  });

  it("UI-SCREENS §5: closeAll pregunta por cada sucia y se detiene al cancelar", async () => {
    invokeMock.mockResolvedValue("x");
    await store.openPaths(["a.md"]);
    await store.openPaths(["b.md"]);
    store.setContent(store.tabs[0].id, "dirty a");
    store.setContent(store.tabs[1].id, "dirty b");
    dialogMocks.message.mockResolvedValueOnce("No guardar").mockResolvedValueOnce("Cancelar");

    const ok = await store.closeAll();

    expect(ok).toBe(false);
    expect(store.tabs).toHaveLength(1);
  });

  it("SPEC-CORE-019: reloadFromDisk reemplaza el texto, limpia dirty y descarta editorState", async () => {
    invokeMock.mockImplementation(async (cmd: string) => (cmd === "read_text_file" ? "original" : undefined));
    await store.openPaths(["a.md"]);
    const tab = store.active;
    if (!tab) throw new Error("sin pestaña activa");
    store.setContent(tab.id, "cambio local sin guardar");
    invokeMock.mockImplementation(async (cmd: string) => (cmd === "read_text_file" ? "cambiado en disco" : undefined));

    await store.reloadFromDisk(tab.id);

    expect(tab.text).toBe("cambiado en disco");
    expect(tab.dirty).toBe(false);
    expect(tab.editorState).toBeNull();
    expect(tab.reloadNonce).toBe(1);
  });

  it("reloadFromDisk en una pestaña sin ruta no hace nada", async () => {
    store.newTab();
    const tab = store.active;
    if (!tab) throw new Error("sin pestaña activa");

    await store.reloadFromDisk(tab.id);

    expect(invokeMock).not.toHaveBeenCalledWith("read_text_file", expect.anything());
    expect(tab.reloadNonce).toBe(0);
  });
});
