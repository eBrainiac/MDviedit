/**
 * Estado reactivo del locale activo, separado de `index.ts` porque TS
 * resuelve `from "../../i18n"` (import de directorio) a `index.ts`, no a
 * `index.svelte.ts` — así los ~15 sitios que ya importan `t` de esa forma
 * no cambian. `currentLocale` es `$state` a propósito: `t()` en index.ts
 * la lee en cada llamada, y como la lectura de un getter que envuelve
 * `$state` sigue siendo reactiva sin importar en qué archivo se define
 * (igual que `tabsStore.active`), cualquier `{t("clave")}` en una plantilla
 * se re-suscribe solo y el cambio de idioma (BL-054) se ve al instante.
 */
import { appConfig, type Locale } from "../config/app.config";

let currentLocale = $state<Locale>(appConfig.preferencesDefaults.locale);

export function getCurrentLocale(): Locale {
  return currentLocale;
}

export function setCurrentLocale(locale: Locale): void {
  currentLocale = locale;
}
