/**
 * Compara un KeyboardEvent contra un atajo declarado en
 * app.config.ts -> shortcuts (formato "Mod+N", "Mod+Shift+S", "Mod+=", …).
 * "Mod" = Cmd en macOS, Ctrl en el resto (UI-TOUCH-CONTROLS §4).
 */
export function isMacPlatform(): boolean {
  const platform = typeof navigator !== "undefined" ? navigator.platform || navigator.userAgent : "";
  return /mac/i.test(platform);
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const segments = shortcut.split("+");
  const key = segments.at(-1) ?? "";
  const modifiers = segments.slice(0, -1);

  const modPressed = isMacPlatform() ? event.metaKey : event.ctrlKey;
  if (modifiers.includes("Mod") !== modPressed) return false;
  if (modifiers.includes("Shift") !== event.shiftKey) return false;
  if (modifiers.includes("Alt") !== event.altKey) return false;

  return event.key.toLowerCase() === key.toLowerCase();
}
