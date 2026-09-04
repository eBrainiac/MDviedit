/**
 * Puente CSS -> TS para los pocos casos donde JS necesita el valor numérico
 * de un token que vive en tokens.css (UI-DESIGN-SYSTEM intro: "se exponen a
 * TypeScript vía app.config.ts, lectura de getComputedStyle, nunca
 * duplicados a mano"). Lee el valor computado, así respeta en automático
 * prefers-reduced-motion (que redefine --dur-* a 0ms en tokens.css).
 */
function readNumberVar(name: string, fallback: number): number {
  if (typeof document === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function getDurMedMs(): number {
  return readNumberVar("--dur-med", 200);
}

const TAB_DEFAULT_W_FALLBACK = 140;
const TAB_MIN_W_FALLBACK = 20;
const TAB_ARROW_W_FALLBACK = 22;

/** TAB-010/011: ancho por defecto de una pestaña (restaurado en doble clic). */
export function getTabDefaultWidthPx(): number {
  return readNumberVar("--tab-default-w", TAB_DEFAULT_W_FALLBACK);
}

/** TAB-010/012: ancho mínimo absoluto de una pestaña. */
export function getTabMinWidthPx(): number {
  return readNumberVar("--tab-min-w", TAB_MIN_W_FALLBACK);
}

/** TAB-012/020: ancho de cada flecha de desplazamiento del carril. */
export function getTabArrowWidthPx(): number {
  return readNumberVar("--tab-arrow-w", TAB_ARROW_W_FALLBACK);
}
