import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// NFR-006 / AT-006: contraste texto/fondo y accent/accent-contrast >= 4.5:1
// en las 3 paletas x 2 modos. Lee los archivos CSS reales (no valores
// duplicados a mano) para que este test no pueda desincronizarse de la
// fuente de verdad de los tokens.

function readPalette(file: string): string {
  return readFileSync(fileURLToPath(new URL(`./palettes/${file}`, import.meta.url)), "utf-8");
}

function extractBlock(css: string, palette: string, theme: string): Record<string, string> {
  const selector = `:root[data-palette="${palette}"][data-theme="${theme}"]`;
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Bloque no encontrado: ${selector}`);
  const braceStart = css.indexOf("{", start);
  const braceEnd = css.indexOf("}", braceStart);
  const body = css.slice(braceStart + 1, braceEnd);
  const vars: Record<string, string> = {};
  for (const match of body.matchAll(/(--[a-z-]+):\s*([^;]+);/g)) {
    vars[match[1]] = match[2].trim();
  }
  return vars;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.length === 4
    ? `#${[...hex.slice(1)].map((c) => c + c).join("")}`
    : hex;
  const value = normalized.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  const linearThreshold = 0.03928;
  return c <= linearThreshold ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const luminanceOffset = 0.05;
  const lumA = relativeLuminance(hexToRgb(hexA));
  const lumB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + luminanceOffset) / (darker + luminanceOffset);
}

const WCAG_AA_MIN_CONTRAST = 4.5;

const palettes = [
  { key: "a", file: "a.css" },
  { key: "b", file: "b.css" },
  { key: "c", file: "c.css" },
] as const;
const themes = ["light", "dark"] as const;

describe.each(palettes)("paleta $key — contraste AA (NFR-006, AT-006)", ({ key, file }) => {
  const css = readPalette(file);

  it.each(themes)("modo %s: --c-text / --c-bg >= 4.5:1", (theme) => {
    const vars = extractBlock(css, key, theme);
    const ratio = contrastRatio(vars["--c-text"], vars["--c-bg"]);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_MIN_CONTRAST);
  });

  it.each(themes)("modo %s: --c-accent-contrast / --c-accent >= 4.5:1", (theme) => {
    const vars = extractBlock(css, key, theme);
    const ratio = contrastRatio(vars["--c-accent-contrast"], vars["--c-accent"]);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_MIN_CONTRAST);
  });
});
