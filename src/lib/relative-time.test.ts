/**
 * UI-SCREENS §1/§3 (SPEC-CORE-021): "hora relativa i18n" de RecentFilesList
 * ("hace 2 h", "ayer").
 */
import { describe, expect, it } from "vitest";
import { setLocale } from "../i18n";
import { appConfig } from "../config/app.config";
import { formatRelativeTime } from "./relative-time";

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-09-04T12:00:00Z");

  it("muestra horas en es-MX ('hace 2 h')", () => {
    setLocale("es-MX");
    const twoHoursAgo = now - 2 * appConfig.behavior.recentTimeHourMs;
    expect(formatRelativeTime(twoHoursAgo, now)).toBe("hace 2 h");
  });

  it("muestra 'ayer' para hace un día en es-MX", () => {
    setLocale("es-MX");
    const yesterday = now - appConfig.behavior.recentTimeDayMs;
    expect(formatRelativeTime(yesterday, now)).toBe("ayer");
  });

  it("localiza en inglés cuando el locale activo es 'en'", () => {
    setLocale("en");
    const twoHoursAgo = now - 2 * appConfig.behavior.recentTimeHourMs;
    expect(formatRelativeTime(twoHoursAgo, now)).toBe("2 hr. ago");
    setLocale("es-MX");
  });

  it("cae a minutos para diferencias menores a una hora", () => {
    setLocale("es-MX");
    const fiveMinutesAgo = now - 5 * appConfig.behavior.recentTimeMinuteMs;
    expect(formatRelativeTime(fiveMinutesAgo, now)).toBe("hace 5 min");
  });
});
