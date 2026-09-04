/**
 * UI-SCREENS §3 (BL-034): enlaces externos se abren en el navegador del
 * sistema con Mod+clic (tauri-plugin-opener); clic simple solo edita
 * (comportamiento por defecto de ProseMirror, no navega).
 */
import { $prose } from "@milkdown/utils";
import { Plugin } from "@milkdown/prose/state";
import { openUrl } from "@tauri-apps/plugin-opener";

function isModPressed(event: MouseEvent): boolean {
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform || navigator.userAgent);
  return isMac ? event.metaKey : event.ctrlKey;
}

export const externalLinkPlugin = $prose(
  () =>
    new Plugin({
      props: {
        handleClick(_view, _pos, event) {
          if (!isModPressed(event)) return false;
          const target = event.target as HTMLElement | null;
          const anchor = target?.closest("a[href]");
          const href = anchor?.getAttribute("href");
          if (!href || !/^https?:\/\//i.test(href)) return false;
          event.preventDefault();
          void openUrl(href);
          return true;
        },
      },
    }),
);
