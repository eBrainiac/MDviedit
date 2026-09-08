// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { matchesShortcut } from "./shortcut-match";

function keydown(init: Partial<KeyboardEventInit> & { key: string }): KeyboardEvent {
  return new KeyboardEvent("keydown", init);
}

function setPlatform(platform: string): void {
  vi.stubGlobal("navigator", { platform, userAgent: platform });
}

describe("matchesShortcut", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("en Windows", () => {
    beforeEach(() => setPlatform("Win32"));

    it("'Mod+W' coincide con Ctrl+W", () => {
      expect(matchesShortcut(keydown({ key: "w", ctrlKey: true }), "Mod+W")).toBe(true);
    });

    it("'Mod+W' no coincide sin Ctrl", () => {
      expect(matchesShortcut(keydown({ key: "w" }), "Mod+W")).toBe(false);
    });

    it("'Mod+W' no coincide con Ctrl+Shift+W (modificador de más)", () => {
      expect(matchesShortcut(keydown({ key: "w", ctrlKey: true, shiftKey: true }), "Mod+W")).toBe(false);
    });

    it("'Ctrl+F4' (closeTabWin, PD-94) coincide con Ctrl+F4", () => {
      expect(matchesShortcut(keydown({ key: "F4", ctrlKey: true }), "Ctrl+F4")).toBe(true);
    });

    it("'Ctrl+F4' no coincide con F4 solo", () => {
      expect(matchesShortcut(keydown({ key: "F4" }), "Ctrl+F4")).toBe(false);
    });

    it("'Ctrl+F4' y 'Mod+W' no se confunden entre sí", () => {
      const ctrlF4 = keydown({ key: "F4", ctrlKey: true });
      expect(matchesShortcut(ctrlF4, "Mod+W")).toBe(false);
      const ctrlW = keydown({ key: "w", ctrlKey: true });
      expect(matchesShortcut(ctrlW, "Ctrl+F4")).toBe(false);
    });
  });

  describe("en macOS", () => {
    beforeEach(() => setPlatform("MacIntel"));

    it("'Mod+W' coincide con Cmd+W (metaKey), no con Ctrl+W", () => {
      expect(matchesShortcut(keydown({ key: "w", metaKey: true }), "Mod+W")).toBe(true);
      expect(matchesShortcut(keydown({ key: "w", ctrlKey: true }), "Mod+W")).toBe(false);
    });

    it("un atajo sin 'Mod' rechaza Cmd de más", () => {
      expect(matchesShortcut(keydown({ key: "F4", ctrlKey: true, metaKey: true }), "Ctrl+F4")).toBe(false);
    });

    it("'Ctrl+F4' sigue exigiendo la tecla Control literal (no Cmd)", () => {
      expect(matchesShortcut(keydown({ key: "F4", ctrlKey: true }), "Ctrl+F4")).toBe(true);
    });
  });
});
