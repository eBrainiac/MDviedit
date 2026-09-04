/**
 * SEC-005 (BL-034): el `toDOM` por defecto de `htmlSchema` (preset-
 * commonmark) muestra el HTML embebido como texto plano (`span.textContent
 * = value`), sin interpretarlo — así preserva el bloque intacto en el
 * modelo, pero no cumple "se muestra en Formato solo tras DOMPurify". Este
 * node view sustituye únicamente el renderizado: sanitiza con DOMPurify y
 * lo pinta como HTML real, sin tocar el esquema/parseo/serialización
 * (que siguen guardando el `value` crudo para el round-trip, BL-031).
 */
import { $view } from "@milkdown/utils";
import { htmlSchema } from "@milkdown/preset-commonmark";
import DOMPurify from "dompurify";

export const htmlNodeView = $view(htmlSchema.node, () => (node) => {
  const container = document.createElement("span");
  container.dataset.type = "html";
  const value = typeof node.attrs.value === "string" ? node.attrs.value : "";
  container.innerHTML = DOMPurify.sanitize(value);
  return { dom: container };
});
