/**
 * Capa 3 de configuración (ADR-006): resolución de textos por clave i18n.
 * RULE-006: todo texto visible es una clave i18n, nunca un literal en un
 * componente. El locale activo se sincroniza con `preferences.locale`
 * (BL-054, cambio en caliente) vía `setLocale`; el estado reactivo en sí
 * vive en `locale-state.svelte.ts` (ver ese archivo para el porqué).
 */
import esMX from "./es-MX.json";
import en from "./en.json";
import type { Locale } from "../config/app.config";
import { getCurrentLocale, setCurrentLocale } from "./locale-state.svelte";

const dictionaries = { "es-MX": esMX, en } satisfies Record<Locale, unknown>;

export function setLocale(locale: Locale): void {
  setCurrentLocale(locale);
}

export function getLocale(): Locale {
  return getCurrentLocale();
}

function lookup(dict: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict);
}

export function t(key: string, params?: Readonly<Record<string, string | number>>): string {
  const value = lookup(dictionaries[getCurrentLocale()], key.split("."));
  let text = typeof value === "string" ? value : key;
  if (params) {
    for (const [param, replacement] of Object.entries(params)) {
      text = text.replaceAll(`{${param}}`, String(replacement));
    }
  }
  return text;
}
