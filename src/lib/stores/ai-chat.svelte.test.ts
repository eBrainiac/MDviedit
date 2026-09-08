/**
 * BL-113/114/115 / AT-096/097/098. `../ai/provider` (que sí toca `invoke`)
 * está mockeado — esta prueba cubre la orquestación del store: contexto por
 * defecto, extracción de la propuesta de cambio, y que Aplicar/Descartar
 * nunca tocan el documento sin el paso explícito (PD-58).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendToBackendMock = vi.hoisted(() => vi.fn());
vi.mock("../ai/provider", () => ({ sendToBackend: sendToBackendMock }));

const tabsStoreMock = vi.hoisted(() => ({
  active: null as { id: string; kind: "file"; text: string; title: string; path: string | null } | null,
  tabs: [] as { id: string; kind: "file"; text: string; title: string; path: string | null }[],
  setContent: vi.fn(),
}));
vi.mock("./tabs.svelte", () => ({ tabsStore: tabsStoreMock }));

const { aiChatStore, extractProposal } = await import("./ai-chat.svelte");

function makeTab(id: string, title: string, text: string) {
  return { id, kind: "file" as const, text, title, path: `${title}` };
}

describe("extractProposal", () => {
  it("plain reply without a proposal block", () => {
    const result = extractProposal("solo una respuesta normal");
    expect(result.outcome).toEqual({ kind: "none" });
    expect(result.text).toBe("solo una respuesta normal");
  });

  it("reply with a proposed-change fence extracts the full content", () => {
    const reply = "Aquí va:\n```mdviedit-proposed-change\n# Nuevo\ncontenido\n```\nlisto.";
    const result = extractProposal(reply);
    expect(result.outcome).toEqual({ kind: "content", proposedContent: "# Nuevo\ncontenido" });
    expect(result.text).not.toContain("mdviedit-proposed-change");
  });

  /** BUG-09: antes caía en el mismo "none" silencioso que un reply sin
   * propuesta — ahora es un resultado distinguible. */
  it("an unclosed fence is reported as malformed, not as a plain reply", () => {
    const reply = "Aquí va:\n```mdviedit-proposed-change\n# Nuevo\ncontenido sin cerrar";
    const result = extractProposal(reply);
    expect(result.outcome).toEqual({ kind: "malformed" });
    expect(result.text).toBe(reply);
  });

  /** BUG-10: bloque bien cerrado pero vacío tras el trim. */
  it("a closed but empty fence is reported as empty, not as real content", () => {
    const reply = "Aquí va:\n```mdviedit-proposed-change\n   \n```\nlisto.";
    const result = extractProposal(reply);
    expect(result.outcome).toEqual({ kind: "empty" });
  });
});

describe("aiChatStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiChatStore.reset();
    tabsStoreMock.active = makeTab("t1", "a.md", "contenido original");
    tabsStoreMock.tabs = [tabsStoreMock.active];
  });

  it("sendMessage: defaults context to the active tab and appends both turns", async () => {
    sendToBackendMock.mockResolvedValue("respuesta simple");
    await aiChatStore.sendMessage("hola");
    expect(aiChatStore.contextTabIds.has("t1")).toBe(true);
    expect(aiChatStore.entries.map((e) => e.role)).toEqual(["user", "assistant"]);
    expect(aiChatStore.entries[1].text).toBe("respuesta simple");
  });

  it("a reply with a proposed change sets pendingDiff but does not touch the document (AT-098/PD-58)", async () => {
    sendToBackendMock.mockResolvedValue("```mdviedit-proposed-change\nnuevo contenido\n```");
    await aiChatStore.sendMessage("cambia esto");
    expect(aiChatStore.pendingDiff).toEqual({ tabId: "t1", before: "contenido original", after: "nuevo contenido" });
    expect(tabsStoreMock.setContent).not.toHaveBeenCalled();
  });

  it("applyPendingDiff writes the proposed content and clears the pending diff", async () => {
    sendToBackendMock.mockResolvedValue("```mdviedit-proposed-change\nnuevo contenido\n```");
    await aiChatStore.sendMessage("cambia esto");
    aiChatStore.applyPendingDiff();
    expect(tabsStoreMock.setContent).toHaveBeenCalledWith("t1", "nuevo contenido");
    expect(aiChatStore.pendingDiff).toBeNull();
  });

  it("discardPendingDiff clears without writing anything", async () => {
    sendToBackendMock.mockResolvedValue("```mdviedit-proposed-change\nnuevo contenido\n```");
    await aiChatStore.sendMessage("cambia esto");
    aiChatStore.discardPendingDiff();
    expect(tabsStoreMock.setContent).not.toHaveBeenCalled();
    expect(aiChatStore.pendingDiff).toBeNull();
  });

  /** BUG-09: antes el reply completo (con el marcador de cerca suelto) se
   * mostraba tal cual, sin ningún aviso de que algo salió mal. */
  it("an unclosed proposed-change fence surfaces a visible error and sets no pendingDiff", async () => {
    sendToBackendMock.mockResolvedValue("```mdviedit-proposed-change\nsin cerrar");
    await aiChatStore.sendMessage("cambia esto");
    expect(aiChatStore.error).toContain("mal formado");
    expect(aiChatStore.pendingDiff).toBeNull();
    expect(tabsStoreMock.setContent).not.toHaveBeenCalled();
  });

  /** BUG-10: antes se ofrecía Aplicar/Descartar sobre un diff que borraba
   * todo el archivo, con solo las líneas en rojo como aviso. */
  it("an empty proposed-change block is rejected with a visible error, no pendingDiff offered", async () => {
    sendToBackendMock.mockResolvedValue("```mdviedit-proposed-change\n   \n```");
    await aiChatStore.sendMessage("borra todo");
    expect(aiChatStore.error).toContain("vacío");
    expect(aiChatStore.pendingDiff).toBeNull();
    expect(tabsStoreMock.setContent).not.toHaveBeenCalled();
  });

  it("a backend error is surfaced without throwing", async () => {
    sendToBackendMock.mockRejectedValue(new Error("sin proveedor configurado"));
    await aiChatStore.sendMessage("hola");
    expect(aiChatStore.error).toContain("sin proveedor configurado");
  });

  it("toggleContextTab adds and removes a tab id", () => {
    aiChatStore.toggleContextTab("t1");
    expect(aiChatStore.contextTabIds.has("t1")).toBe(true);
    aiChatStore.toggleContextTab("t1");
    expect(aiChatStore.contextTabIds.has("t1")).toBe(false);
  });
});
