/**
 * SPEC-CORE-020 / SEC-006 (BL-034): sustituye el renderizado por defecto de
 * `imageSchema` (solo cambia el `toDOM`, no el esquema/parseo/serialización)
 * para resolver rutas relativas contra la carpeta del archivo vía el
 * comando Rust `resolve_local_image` y servirlas por `asset:`
 * (`convertFileSrc`). Las URLs remotas se dejan pasar tal cual — el CSP
 * (`img-src 'self' asset: data:`) ya las bloquea sin necesidad de código
 * aquí (AT-091).
 */
import { $view } from "@milkdown/utils";
import { imageSchema } from "@milkdown/preset-commonmark";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";

/** MEM-001: un solo editor Milkdown vivo a la vez — basta un módulo mutable. */
export const imageContext: { baseDir: string | null } = { baseDir: null };

const resolvedCache = new Map<string, string>();

function isRemoteOrData(src: string): boolean {
  return /^([a-z][a-z0-9+.-]*:)?\/\//i.test(src) || src.startsWith("data:");
}

export const imageNodeView = $view(imageSchema.node, () => (node) => {
  const img = document.createElement("img");
  img.alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  if (typeof node.attrs.title === "string" && node.attrs.title) img.title = node.attrs.title;
  img.style.maxWidth = "100%";

  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";

  if (!src || isRemoteOrData(src)) {
    img.src = src;
    return { dom: img };
  }

  const baseDir = imageContext.baseDir;
  if (!baseDir) return { dom: img };

  const cacheKey = `${baseDir}::${src}`;
  const cached = resolvedCache.get(cacheKey);
  if (cached) {
    img.src = cached;
    return { dom: img };
  }

  invoke<string>("resolve_local_image", { baseDir, relativePath: src })
    .then((absolute) => {
      const assetUrl = convertFileSrc(absolute, "asset");
      resolvedCache.set(cacheKey, assetUrl);
      img.src = assetUrl;
    })
    .catch(() => {
      img.alt = img.alt.length > 0 ? img.alt : src;
    });

  return { dom: img };
});
