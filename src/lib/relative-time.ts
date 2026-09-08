/**
 * UI-SCREENS §1/§3 (SPEC-CORE-021): hora relativa i18n de `RecentFilesList`
 * ("hace 2 h", "ayer"). Usa `Intl.RelativeTimeFormat` con el locale activo
 * en vez de claves i18n por unidad/plural a mano — el motor de JS ya
 * localiza correctamente es-MX/en (incluyendo "ayer"/"yesterday" vía
 * `numeric: "auto"`), sin duplicar esa lógica en `i18n/*.json`.
 */
import { getLocale } from "../i18n";
import { appConfig } from "../config/app.config";

const UNITS: readonly { readonly ms: number; readonly unit: Intl.RelativeTimeFormatUnit }[] = [
  { ms: appConfig.behavior.recentTimeYearMs, unit: "year" },
  { ms: appConfig.behavior.recentTimeMonthMs, unit: "month" },
  { ms: appConfig.behavior.recentTimeWeekMs, unit: "week" },
  { ms: appConfig.behavior.recentTimeDayMs, unit: "day" },
  { ms: appConfig.behavior.recentTimeHourMs, unit: "hour" },
  { ms: appConfig.behavior.recentTimeMinuteMs, unit: "minute" },
];

export function formatRelativeTime(timestampMs: number, nowMs: number = Date.now()): string {
  const diffMs = timestampMs - nowMs;
  const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: "auto", style: "short" });
  for (const { ms, unit } of UNITS) {
    if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return rtf.format(0, "second");
}
