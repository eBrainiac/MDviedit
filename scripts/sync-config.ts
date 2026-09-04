/**
 * pnpm sync-config — genera valores derivados en tauri.conf.json a partir de
 * src/config/app.config.ts (fuente única, CFG-003, ADR-006). Se ejecuta antes
 * de `dev` y `build` (ver package.json → predev/prebuild).
 *
 * No se edita tauri.conf.json a mano para: identifier, productName, tamaño
 * mínimo de ventana, fileAssociations.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { appConfig } from "../src/config/app.config.ts";

const tauriConfPath = fileURLToPath(
  new URL("../src-tauri/tauri.conf.json", import.meta.url),
);

const conf = JSON.parse(readFileSync(tauriConfPath, "utf-8"));

conf.productName = appConfig.name;
conf.identifier = appConfig.id;

conf.app ??= {};
conf.app.windows ??= [{}];
conf.app.windows[0].title = appConfig.name;
conf.app.windows[0].width = appConfig.window.minWidth;
conf.app.windows[0].height = appConfig.window.minHeight;
conf.app.windows[0].minWidth = appConfig.window.minWidth;
conf.app.windows[0].minHeight = appConfig.window.minHeight;

const ext = [...appConfig.fileFilters.extensions];
conf.bundle ??= {};
conf.bundle.fileAssociations = [
  {
    ext,
    name: appConfig.fileFilters.name,
    description: "Documento Markdown",
    role: "Editor",
    // MAC-T2/T3/T4 (DISTRIBUTION.md): MDviedit es un visor secundario, no
    // forzado como predeterminado.
    rank: "Alternate",
  },
  {
    // MAC-T3 (DISTRIBUTION.md §3, PD-26): "Abrir con" sobre carpetas en
    // Finder. `ext: []` porque una carpeta no tiene extensión — Tauri solo
    // agrega `LSItemContentTypes: ["public.folder"]` al Info.plist. Va aquí
    // (no en un Info.plist propio) porque tauri-bundler fusiona
    // bundle.macOS.infoPlist reemplazando la clave CFBundleDocumentTypes
    // completa en vez de concatenar arrays — un Info.plist aparte borraría
    // esta entrada de md/markdown/txt.
    ext: [],
    name: "Carpeta",
    contentTypes: ["public.folder"],
    role: "Editor",
    rank: "Alternate",
  },
];

writeFileSync(tauriConfPath, `${JSON.stringify(conf, null, 2)}\n`, "utf-8");

console.log(`sync-config: ${tauriConfPath} actualizado desde app.config.ts`);
