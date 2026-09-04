// @vitest-environment jsdom
/**
 * BL-031 / AT-014b: abrir kitchen-sink.md en Formato, volver a Sin formato
 * sin editar, guardar → diff vacío contra el original tras la normalización
 * documentada (ADR-004: viñetas "-", énfasis "*"/"**"). Corre el mismo
 * parser/serializador (commonmark + gfm + frontmatter) que
 * WysiwygEditorView, fuera de un componente Svelte real porque Milkdown
 * necesita un DOM (jsdom aquí) pero no necesita una vista visible.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Editor, rootCtx, defaultValueCtx, remarkStringifyOptionsCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { getMarkdown } from "@milkdown/utils";
import { frontmatter } from "./frontmatter-plugin";
import { remarkStringifyOptions } from "./milkdown-setup";

const fixturePath = resolve(process.cwd(), "fixtures/kitchen-sink.md");

async function roundTrip(markdown: string): Promise<string> {
  const root = document.createElement("div");
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, markdown);
      ctx.set(remarkStringifyOptionsCtx, remarkStringifyOptions);
    })
    .use(commonmark)
    .use(gfm)
    .use(frontmatter)
    .create();

  const out = editor.action(getMarkdown());
  editor.destroy();
  return out;
}

describe("round-trip Markdown -> Milkdown -> Markdown (BL-031, AT-014b)", () => {
  let originalAddEventListener: typeof globalThis.addEventListener;

  beforeEach(() => {
    // Milkdown's Ctx timers dispatch DOM events on the global object
    // directly (not window.addEventListener); bridge them to jsdom's window.
    originalAddEventListener = globalThis.addEventListener;
    globalThis.addEventListener = window.addEventListener.bind(window);
    globalThis.removeEventListener = window.removeEventListener.bind(window);
    globalThis.dispatchEvent = window.dispatchEvent.bind(window);
  });

  afterEach(() => {
    globalThis.addEventListener = originalAddEventListener;
  });

  it("produce un diff vacío contra fixtures/kitchen-sink.md (ya en su forma normalizada)", async () => {
    const source = readFileSync(fixturePath, "utf-8").replace(/\r\n/g, "\n");

    const output = await roundTrip(source);

    expect(output.trimEnd()).toBe(source.trimEnd());
  });

  it("es idempotente: una segunda vuelta no cambia el resultado", async () => {
    const source = readFileSync(fixturePath, "utf-8").replace(/\r\n/g, "\n");

    const first = await roundTrip(source);
    const second = await roundTrip(first);

    expect(second.trimEnd()).toBe(first.trimEnd());
  });

  it("conserva el front-matter YAML intacto", async () => {
    const source = "---\ntitle: X\n---\n\nHola\n";

    const output = await roundTrip(source);

    expect(output.trimEnd()).toBe(source.trimEnd());
  });

  it("conserva el HTML embebido intacto", async () => {
    const source = '<div class="a">\n  <strong>b</strong>\n</div>\n';

    const output = await roundTrip(source);

    expect(output.trimEnd()).toBe(source.trimEnd());
  });
});
