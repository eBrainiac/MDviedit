import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [sveltekit()],

  // BL-030: `@milkdown/prose/state` es un subpath fuera del grafo que el
  // escáner de optimizeDeps sigue por defecto a partir de las importaciones
  // de nivel superior de Milkdown; sin listarlo aquí, Vite lo pre-empaqueta
  // en un chunk aparte y el navegador acaba con dos copias vivas de
  // prosemirror-state (cada una con su propio contador de claves de
  // plugin), lo que ProseMirror reporta como "Adding different instances
  // of a keyed plugin".
  optimizeDeps: {
    include: ["@milkdown/prose/state"],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
