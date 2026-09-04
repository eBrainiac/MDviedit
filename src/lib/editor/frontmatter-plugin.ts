/**
 * ADR-004 "Modelo único": el front-matter YAML no es un elemento CommonMark/
 * GFM — ni `@milkdown/preset-commonmark` ni `@milkdown/preset-gfm` lo
 * reconocen (sin este plugin, el bloque `---\n...\n---` se mezcla con el
 * contenido normal y se destruye). Este plugin registra `remark-frontmatter`
 * (parseo) y un nodo ProseMirror "frontmatter" atómico que guarda el YAML
 * crudo como atributo, igual que `htmlSchema` de preset-commonmark hace con
 * el HTML embebido — así el bloque se conserva intacto (BL-031).
 */
import { $nodeSchema, $remark } from "@milkdown/utils";
import remarkFrontmatter from "remark-frontmatter";

export const remarkFrontmatterPlugin = $remark("remarkFrontmatter", () => remarkFrontmatter, ["yaml"]);

export const frontmatterSchema = $nodeSchema("frontmatter", () => ({
  group: "block",
  atom: true,
  attrs: { value: { default: "" } },
  toDOM: (node) => ["pre", { "data-type": "frontmatter" }, node.attrs.value as string],
  parseDOM: [
    {
      tag: 'pre[data-type="frontmatter"]',
      getAttrs: (dom) => ({ value: (dom as HTMLElement).textContent ?? "" }),
    },
  ],
  parseMarkdown: {
    match: ({ type }) => type === "yaml",
    runner: (state, node, type) => {
      state.addNode(type, { value: (node.value as string | undefined) ?? "" });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "frontmatter",
    runner: (state, node) => {
      state.addNode("yaml", undefined, node.attrs.value as string);
    },
  },
}));

export const frontmatter = [remarkFrontmatterPlugin, frontmatterSchema].flat();
