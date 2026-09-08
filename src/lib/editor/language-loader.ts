/**
 * BL-126/ADR-013: carga del paquete de lenguaje de CodeMirror 6 para una
 * pestaña `editMode: 'code'`. Cada `import()` usa un literal de string
 * distinto (no una variable) para que Vite genere un chunk separado por
 * paquete — el bundle inicial no paga el costo de los seis a la vez, solo
 * el de la pestaña realmente abierta (NFR-008, ver ADR-013 §Consecuencias).
 */
import type { Extension } from "@codemirror/state";
import type { LanguagePackage } from "../../config/app.config";

export async function loadLanguageExtension(languagePackage: LanguagePackage | undefined): Promise<Extension[]> {
  switch (languagePackage) {
    case "@codemirror/lang-python": {
      const { python } = await import("@codemirror/lang-python");
      return [python()];
    }
    case "@codemirror/lang-json": {
      const { json } = await import("@codemirror/lang-json");
      return [json()];
    }
    case "@codemirror/lang-javascript": {
      const { javascript } = await import("@codemirror/lang-javascript");
      return [javascript({ typescript: true })];
    }
    case "@codemirror/lang-yaml": {
      const { yaml } = await import("@codemirror/lang-yaml");
      return [yaml()];
    }
    case "@codemirror/lang-css": {
      const { css } = await import("@codemirror/lang-css");
      return [css()];
    }
    case "@codemirror/lang-html": {
      const { html } = await import("@codemirror/lang-html");
      return [html()];
    }
    default:
      return [];
  }
}
