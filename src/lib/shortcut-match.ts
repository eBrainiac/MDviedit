/**
 * Compara un KeyboardEvent contra un atajo declarado en
 * app.config.ts -> shortcuts (formato "Mod+N", "Mod+Shift+S", "Mod+=", …).
 * "Mod" = Cmd en macOS, Ctrl en el resto (UI-TOUCH-CONTROLS §4). "Ctrl"
 * (literal, distinto de "Mod") es la tecla Control tal cual, sin traducir
 * por plataforma — solo para atajos explícitamente atados a Windows como
 * `closeTabWin` (PD-94), donde el llamador ya filtra por plataforma.
 */
export function isMacPlatform(): boolean {
  const platform = typeof navigator !== "undefined" ? navigator.platform || navigator.userAgent : "";
  return /mac/i.test(platform);
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const segments = shortcut.split("+");
  const key = segments.at(-1) ?? "";
  const modifiers = segments.slice(0, -1);

  // "Mod" y "Ctrl" son mutuamente excluyentes dentro de un mismo atajo — el
  // primero se traduce por plataforma, el segundo es literal (solo para
  // atajos explícitamente atados a una plataforma, como `closeTabWin`,
  // PD-94). En Windows/Linux "Mod" y "Ctrl" son la misma tecla física, así
  // que el guard de "sin Mod de más" solo tiene sentido contra Cmd en
  // macOS — ctrlKey lo gobierna siempre el token "Ctrl" explícito.
  if (modifiers.includes("Mod")) {
    const modPressed = isMacPlatform() ? event.metaKey : event.ctrlKey;
    if (!modPressed) return false;
  } else {
    if (isMacPlatform() && event.metaKey) return false;
    if (modifiers.includes("Ctrl") !== event.ctrlKey) return false;
  }
  if (modifiers.includes("Shift") !== event.shiftKey) return false;
  if (modifiers.includes("Alt") !== event.altKey) return false;

  return event.key.toLowerCase() === key.toLowerCase();
}
