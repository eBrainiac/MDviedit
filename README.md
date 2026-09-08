# MDviedit

Editor y visor de Markdown de escritorio para Windows y macOS — vistas **Formato** (WYSIWYG) y **Sin formato**, pestañas múltiples, tres paletas de color con modo claro/oscuro, soporte de archivos de código, y un Chat de IA opcional sobre tus archivos.

## Descargas

Última versión estable: **[v1.1.0](https://github.com/eBrainiac/MDviedit/releases/latest)**

| Plataforma | Instalador | Requisitos |
|---|---|---|
| Windows | `MDviedit_1.1.0_x64-setup.exe` (NSIS) | Windows 10 (1809+) o 11, x64 |
| macOS | `MDviedit_1.1.0_aarch64.dmg` | macOS 11 (Big Sur) o superior, Apple Silicon (M1–M4) |

Ambos instaladores están adjuntos como assets del [release `v1.1.0`](https://github.com/eBrainiac/MDviedit/releases/latest) — no hay instaladores versionados dentro del repositorio en sí, solo el código fuente. macOS Intel y Windows arm64 no están soportados por ahora.

## Características

- **Formato / Sin formato**: edición WYSIWYG (Milkdown) o texto crudo (CodeMirror 6), por pestaña.
- **Archivos de código**: `.py`, `.json`, `.js`/`.ts`, `.yaml`/`.yml`, `.css` y `.html` con resaltado de sintaxis real — se abren directo en modo código, sin el conmutador de Markdown.
- **Pestañas múltiples**, con recuperación de sesión al reabrir la app.
- **Arrastrar y soltar** un archivo sobre la ventana para abrirlo.
- **Archivos recientes**, con lista configurable.
- **Vigilancia de archivos**: aviso para recargar si un archivo abierto cambia fuera de la app.
- **3 paletas de color** con modo claro/oscuro.
- **Chat de IA** (opcional, apagado por defecto): panel lateral sobre tus archivos abiertos, con modelo local (Qwen3.5-4B) o BYOK (cualquier endpoint compatible con OpenAI o Anthropic). Único punto de la app con acceso a red — todo lo demás funciona sin conexión.
- Atajos de teclado estándar (`Ctrl/Cmd+W`, y `Ctrl+F4` en Windows, para cerrar pestaña; etc.).

## Requisitos (desarrollo)

- [pnpm](https://pnpm.io/)
- [Rust estable](https://www.rust-lang.org/tools/install) (toolchain MSVC en Windows)
- En Windows: Microsoft C++ Build Tools ("Desktop development with C++")
- En macOS: Xcode

## Desarrollo

```sh
pnpm install
pnpm tauri dev
```

## Build

```sh
pnpm tauri build
```

## Licencia

MIT — ver [LICENSE](./LICENSE).
