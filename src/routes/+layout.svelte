<script lang="ts">
  import "../config/tokens.css";
  import "../config/palettes/a.css";
  import "../config/palettes/b.css";
  import "../config/palettes/c.css";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { listen } from "@tauri-apps/api/event";
  import { invoke } from "@tauri-apps/api/core";
  import { getMatches } from "@tauri-apps/plugin-cli";
  import { message } from "@tauri-apps/plugin-dialog";
  import { preferences } from "../lib/stores/preferences.svelte";
  import { tabsStore } from "../lib/stores/tabs.svelte";
  import { isMacPlatform } from "../lib/shortcut-match";
  import { t } from "../i18n";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();

  // Aplica paleta/tema (default b/system) y arranca el listener de tema
  // del SO (AT-004). La preferencia persistida sustituye el default en
  // cuanto tauri-plugin-store resuelve (ADR-006 capa 4).
  const preferencesReady = preferences.init();
  void preferencesReady;
  // SPEC-CORE-016 / BL-026: reabre las pestañas con ruta de la sesión anterior.
  void tabsStore.restoreSession();

  interface CliOpenArgs {
    new: boolean;
    paths: string[];
  }

  /** BL-052 / SEC-011: `paths` ya llega validado y expandido por
   * `resolve_cli_paths` (canonicaliza, exige extensión permitida, expande
   * carpetas a su primer nivel con tope `maxFolderOpen`). */
  async function handleCliOpen(args: CliOpenArgs): Promise<void> {
    if (args.new) tabsStore.newTab();
    if (args.paths.length === 0) return;
    const resolved = await invoke<string[]>("resolve_cli_paths", { paths: args.paths });
    if (resolved.length > 0) await tabsStore.openPaths(resolved);
  }

  // BL-052: argumentos del lanzamiento actual (mdviedit <rutas…> / --new).
  // `getMatches()` lanza fuera de un contexto Tauri real (Chrome en
  // desarrollo); se ignora igual que el resto de llamadas a plugins ahí.
  void (async () => {
    try {
      const matches = await getMatches();
      const newFlag = matches.args.new?.value === true;
      const pathsValue = matches.args.paths?.value;
      const paths = Array.isArray(pathsValue) ? pathsValue : [];
      if (newFlag || paths.length > 0) await handleCliOpen({ new: newFlag, paths });
    } catch {
      // no-op
    }
  })();

  // BL-052: reinvocación de single-instance o RunEvent::Opened (mac) —
  // ambas reenvían al mismo evento "cli-open" desde el lado Rust (ver
  // src-tauri/src/lib.rs).
  $effect(() => {
    let unlisten: (() => void) | undefined;
    void listen<CliOpenArgs>("cli-open", (event) => void handleCliOpen(event.payload)).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  });

  // BL-053 / PD-28 (mac): aviso "¿Mantener en el Dock?" una sola vez. Espera
  // a que `preferences.init()` termine de hidratar `dockPromptDismissed`
  // desde disco antes de decidir si mostrarlo — si no, se mostraría en cada
  // arranque porque el valor por defecto en memoria es `false`.
  void (async () => {
    await preferencesReady;
    if (!isMacPlatform() || preferences.dockPromptDismissed) return;
    try {
      await message(t("dialog.dockPromptMessage"), {
        title: t("preferences.tabTitle"),
        kind: "info",
        buttons: { ok: t("dialog.dockPromptDontAskAgain") },
      });
      preferences.setDockPromptDismissed(true);
    } catch {
      // no-op (fuera de un contexto Tauri real)
    }
  })();

  // SPEC-CORE-007 / BL-025 (PD-08): al cerrar la ventana se pregunta por
  // cada pestaña sucia; si se cancela cualquiera, se aborta el cierre.
  $effect(() => {
    let unlisten: (() => void) | undefined;
    try {
      void getCurrentWindow()
        .onCloseRequested(async (event) => {
          const canClose = await tabsStore.closeAllForWindowExit();
          if (!canClose) event.preventDefault();
        })
        .then((fn) => {
          unlisten = fn;
        });
    } catch {
      // Fuera de un contexto Tauri real (p. ej. verificación en Chrome
      // durante desarrollo) getCurrentWindow() lanza de forma síncrona;
      // ignorarlo evita corromper el scheduler de efectos de Svelte.
    }
    return () => unlisten?.();
  });
</script>

{@render children()}

<style>
  :global(html),
  :global(body) {
    margin: 0;
    height: 100%;
    background: var(--c-bg);
    color: var(--c-text);
    font-family: var(--font-ui);
    font-size: var(--fs-ui);
    line-height: var(--lh-ui);
  }

  /* SPEC-CORE-012 / BL-015: 8px, 10px en hover, en ambos modos. WebView2 y
     WKWebView son Chromium/WebKit: ::-webkit-scrollbar está garantizado;
     scrollbar-width es el fallback estándar. */
  :global(*) {
    scrollbar-width: thin;
    scrollbar-color: var(--c-scrollbar) var(--scrollbar-track);
  }

  :global(*::-webkit-scrollbar) {
    width: var(--scrollbar-thickness);
    height: var(--scrollbar-thickness);
  }

  :global(*::-webkit-scrollbar-track) {
    background: var(--scrollbar-track);
  }

  :global(*::-webkit-scrollbar-thumb) {
    background: var(--c-scrollbar);
    border-radius: var(--scrollbar-radius);
  }

  :global(*::-webkit-scrollbar-thumb:hover) {
    background: var(--c-scrollbar-hover);
  }

  :global(*:hover::-webkit-scrollbar) {
    width: var(--scrollbar-thickness-hover);
    height: var(--scrollbar-thickness-hover);
  }
</style>
