/**
 * BL-113/114/115 / SPEC-CORE-022 / UI-SCREENS §10: estado del panel de Chat
 * de IA — historial, selector de contexto, backend activo, diff propuesto.
 * No persiste entre reinicios (a diferencia de preferencias/sesión):
 * UI-SCREENS §10 no pide conservar el historial de conversación, es efímero
 * por diseño.
 */
import { SvelteSet } from "svelte/reactivity";
import { tabsStore } from "./tabs.svelte";
import { sendToBackend, type AiChatMessage } from "../ai/provider";
import { summarizeFiles, type SummarizableFile } from "../ai/summarize";
import { diffLines, type DiffLine } from "../ai/text-diff";
import type { AiBackend } from "../../config/app.config";

const SYSTEM_PROMPT =
  "Eres el asistente de IA integrado en MDviedit, un editor de Markdown. " +
  "Responde en el idioma del usuario. Si el usuario pide un cambio al " +
  "archivo activo, responde con una breve explicación y, envuelto en un " +
  "bloque de código con la etiqueta mdviedit-proposed-change, el CONTENIDO " +
  "COMPLETO del archivo ya modificado (no solo el fragmento cambiado).";

const PROPOSAL_FENCE_OPEN = "```mdviedit-proposed-change";
const PROPOSAL_FENCE_CLOSE = "```";

export interface ChatEntry {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
}

export interface PendingDiff {
  readonly tabId: string;
  readonly before: string;
  readonly after: string;
}

/** BUG-09/BUG-10 (PD-69): los dos huecos de robustez que salieron a la luz
 * al documentar el protocolo — antes ambos caían en el mismo fallback
 * silencioso que un reply sin propuesta (`proposedContent: null`), sin
 * avisar nada. Ahora son resultados explícitos que `#applyReply` convierte
 * en un error visible, nunca en una propuesta a medias. */
export type ProposalOutcome =
  | { readonly kind: "none" }
  | { readonly kind: "malformed" }
  | { readonly kind: "empty" }
  | { readonly kind: "content"; readonly proposedContent: string };

/** BL-115: protocolo propio (sin uno documentado en UI-SCREENS/ADR-010) —
 * un cambio propuesto viaja como un bloque de código cercado con la
 * etiqueta `mdviedit-proposed-change` dentro de la respuesta del asistente,
 * con el contenido completo del archivo ya modificado. */
export function extractProposal(reply: string): { text: string; outcome: ProposalOutcome } {
  const start = reply.indexOf(PROPOSAL_FENCE_OPEN);
  if (start === -1) return { text: reply, outcome: { kind: "none" } };
  const contentStart = start + PROPOSAL_FENCE_OPEN.length;
  const end = reply.indexOf(PROPOSAL_FENCE_CLOSE, contentStart);
  // BUG-09: cerca de apertura sin su cierre — antes se mostraba el reply
  // completo (con el marcador de cerca suelto filtrándose como texto) como
  // si no hubiera propuesta. Ahora se marca explícitamente como malformado
  // para que #applyReply muestre un error visible en vez de dejarlo pasar.
  if (end === -1) return { text: reply, outcome: { kind: "malformed" } };
  const proposedContent = reply.slice(contentStart, end).trim();
  const remainder = (reply.slice(0, start) + reply.slice(end + PROPOSAL_FENCE_CLOSE.length)).trim();
  // BUG-10: bloque bien cerrado pero vacío tras el trim (el modelo
  // "propondría" vaciar el archivo entero) — se rechaza de plano en vez de
  // ofrecer Aplicar/Descartar sobre un diff que borra todo sin más aviso
  // que las líneas en rojo del propio diff.
  if (proposedContent === "") return { text: remainder, outcome: { kind: "empty" } };
  return { text: remainder, outcome: { kind: "content", proposedContent } };
}

class AiChatStore {
  entries = $state<ChatEntry[]>([]);
  backend = $state<AiBackend>("byok");
  contextTabIds = new SvelteSet<string>();
  pendingDiff = $state<PendingDiff | null>(null);
  sending = $state(false);
  error = $state<string | null>(null);

  #nextId = 0;

  #makeId(): string {
    this.#nextId += 1;
    return `msg-${this.#nextId}`;
  }

  reset(): void {
    this.entries = [];
    this.pendingDiff = null;
    this.error = null;
    this.contextTabIds.clear();
  }

  toggleContextTab(tabId: string): void {
    if (this.contextTabIds.has(tabId)) {
      this.contextTabIds.delete(tabId);
    } else {
      this.contextTabIds.add(tabId);
    }
  }

  #ensureDefaultContext(): void {
    if (this.contextTabIds.size > 0) return;
    const active = tabsStore.active;
    if (active && active.kind === "file") this.contextTabIds.add(active.id);
  }

  #contextFiles(): SummarizableFile[] {
    return tabsStore.tabs
      .filter((tab) => tab.kind === "file" && this.contextTabIds.has(tab.id))
      .map((tab) => ({ path: tab.path ?? tab.title, title: tab.title, text: tab.text }));
  }

  async sendMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || this.sending) return;
    this.#ensureDefaultContext();
    this.error = null;
    this.entries = [...this.entries, { id: this.#makeId(), role: "user", text: trimmed }];
    this.sending = true;
    try {
      const reply = await sendToBackend(this.backend, this.#historyForRequest());
      this.#applyReply(reply);
    } catch (err) {
      this.error = String(err);
    } finally {
      this.sending = false;
    }
  }

  #historyForRequest(): AiChatMessage[] {
    const contextBlock = this.#contextFiles()
      .map((file) => `# ${file.title}\n\n${file.text}`)
      .join("\n\n---\n\n");
    return [
      { role: "system", content: SYSTEM_PROMPT },
      ...(contextBlock ? [{ role: "system" as const, content: `Contexto de archivos abiertos:\n\n${contextBlock}` }] : []),
      ...this.entries.map((entry) => ({ role: entry.role, content: entry.text })),
    ];
  }

  #applyReply(reply: string): void {
    const { text, outcome } = extractProposal(reply);
    this.entries = [...this.entries, { id: this.#makeId(), role: "assistant", text }];
    // BUG-09: fence sin cerrar — error visible, nunca un pendingDiff a
    // medias ni el marcador de cerca filtrándose sin más en el mensaje.
    if (outcome.kind === "malformed") {
      this.error = "El modelo generó un bloque de cambio propuesto mal formado (sin cerrar) — no se pudo procesar.";
      return;
    }
    // BUG-10: bloque vacío tras el trim — se rechaza directo (más simple y
    // más seguro que ofrecer Aplicar sobre un diff que borra todo el
    // archivo con solo las líneas en rojo como aviso).
    if (outcome.kind === "empty") {
      this.error = "El modelo propuso dejar el archivo vacío — no se aplicó ningún cambio.";
      return;
    }
    if (outcome.kind === "none") return;
    const active = tabsStore.active;
    if (active && active.kind === "file") {
      this.pendingDiff = { tabId: active.id, before: active.text, after: outcome.proposedContent };
    }
  }

  /** BL-114 / AT-096/097. */
  async summarizeContext(contextTokenLimit: number): Promise<void> {
    if (this.sending) return;
    this.#ensureDefaultContext();
    const files = this.#contextFiles();
    if (files.length === 0) return;
    this.error = null;
    this.sending = true;
    try {
      const summary = await summarizeFiles(files, contextTokenLimit, (prompt) =>
        sendToBackend(this.backend, [{ role: "user", content: prompt }]),
      );
      this.entries = [...this.entries, { id: this.#makeId(), role: "assistant", text: summary }];
    } catch (err) {
      this.error = String(err);
    } finally {
      this.sending = false;
    }
  }

  /** PD-58 / AT-098: nunca se escribe al documento sin este paso. */
  applyPendingDiff(): void {
    if (!this.pendingDiff) return;
    tabsStore.setContent(this.pendingDiff.tabId, this.pendingDiff.after);
    this.pendingDiff = null;
  }

  discardPendingDiff(): void {
    this.pendingDiff = null;
  }

  diffLinesForPending(): DiffLine[] {
    if (!this.pendingDiff) return [];
    return diffLines(this.pendingDiff.before, this.pendingDiff.after);
  }
}

export const aiChatStore = new AiChatStore();
