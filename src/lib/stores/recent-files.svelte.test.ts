/**
 * Cobertura automática de AT-085/087/088 (SPEC-CORE-021, BL-108).
 * `@tauri-apps/plugin-store` se mockea porque no hay puente IPC de Tauri
 * fuera de la app empaquetada — igual que TabsStore mockea plugin-dialog.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-store", () => ({
  Store: { load: vi.fn(async () => storeMocks) },
}));

const { RecentFilesStore } = await import("./recent-files.svelte");

describe("RecentFilesStore", () => {
  let store: InstanceType<typeof RecentFilesStore>;

  beforeEach(() => {
    store = new RecentFilesStore();
    vi.clearAllMocks();
    storeMocks.get.mockResolvedValue(null);
    storeMocks.set.mockResolvedValue(undefined);
    storeMocks.save.mockResolvedValue(undefined);
  });

  it("touch agrega una entrada nueva al frente (SPEC-CORE-021)", () => {
    store.touch("a.md", "a.md");
    expect(store.entries).toHaveLength(1);
    expect(store.entries[0].path).toBe("a.md");
  });

  it("touch de una ruta ya presente la mueve al frente sin duplicarla (AT-085)", () => {
    store.touch("a.md", "a.md");
    store.touch("b.md", "b.md");
    store.touch("c.md", "c.md");
    store.touch("a.md", "a.md");
    expect(store.entries.map((e) => e.path)).toEqual(["a.md", "c.md", "b.md"]);
  });

  it("visible ordena por lastAccessedAt descendente y respeta el límite (AT-088)", () => {
    store.touch("a.md", "a.md");
    store.touch("b.md", "b.md");
    store.touch("c.md", "c.md");
    expect(store.visible(2).map((e) => e.path)).toEqual(["c.md", "b.md"]);
  });

  it("visible no recorta el historial guardado, solo lo que se muestra (AT-088)", () => {
    for (let i = 0; i < 8; i += 1) store.touch(`f${i}.md`, `f${i}.md`);
    expect(store.entries).toHaveLength(8);
    expect(store.visible(5)).toHaveLength(5);
    expect(store.visible(20)).toHaveLength(8);
  });

  it("remove quita solo la entrada indicada, sin tocar el resto (AT-087)", () => {
    store.touch("a.md", "a.md");
    store.touch("b.md", "b.md");
    store.remove("a.md");
    expect(store.entries.map((e) => e.path)).toEqual(["b.md"]);
  });

  it("remove compara rutas sin distinguir mayúsculas/minúsculas (paridad con TabsStore)", () => {
    store.touch("C:/Docs/a.md", "a.md");
    store.remove("c:/docs/a.md");
    expect(store.entries).toHaveLength(0);
  });

  it("clear vacía toda la lista (enlace 'Limpiar recientes')", () => {
    store.touch("a.md", "a.md");
    store.touch("b.md", "b.md");
    store.clear();
    expect(store.entries).toHaveLength(0);
  });

  it("init hidrata desde el store persistido y descarta valores inválidos", async () => {
    storeMocks.get.mockResolvedValue("no-es-un-array");
    await store.init();
    expect(store.entries).toEqual([]);
  });

  it("init hidrata las entradas guardadas previamente", async () => {
    const persisted = [{ path: "a.md", title: "a.md", lastAccessedAt: 1 }];
    storeMocks.get.mockResolvedValue(persisted);
    await store.init();
    expect(store.entries).toEqual(persisted);
  });
});
