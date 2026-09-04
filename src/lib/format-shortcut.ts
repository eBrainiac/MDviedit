/**
 * IN-003: cada control muestra su atajo en el tooltip. Los atajos se
 * definen con el marcador "Mod" (app.config.ts, UI-TOUCH-CONTROLS §4);
 * aquí se resuelve a Ctrl/Cmd según la plataforma para mostrarlo.
 */
export function formatShortcut(shortcut: string): string {
  const platform = typeof navigator !== "undefined" ? navigator.platform || navigator.userAgent : "";
  const isMac = /mac/i.test(platform);
  return shortcut.replaceAll("Mod", isMac ? "Cmd" : "Ctrl");
}
