import { describe, expect, it } from "vitest";
import { appConfig, fileTypeForPath } from "./app.config";

describe("appConfig", () => {
  it("identifica la app según PD-11/PQ-02", () => {
    expect(appConfig.name).toBe("MDviedit");
    expect(appConfig.id).toBe("mx.mdviedit.app");
  });

  it("expone los filtros de archivo de SPEC-CORE-001/023 (PD-23, PD-89/90)", () => {
    expect(appConfig.fileFilters.extensions.slice().sort()).toEqual(
      ["css", "html", "js", "json", "md", "markdown", "py", "txt", "yaml", "yml", "ts"].sort(),
    );
  });

  it("usa la paleta B y modo sistema por defecto (SPEC-CORE-011)", () => {
    expect(appConfig.preferencesDefaults.palette).toBe("b");
    expect(appConfig.preferencesDefaults.themeMode).toBe("system");
  });

  it("el switch dedicado del modelo local arranca apagado (SPEC-CORE-022 enmienda, PD-93, BUG-12)", () => {
    expect(appConfig.preferencesDefaults.aiUseLocalModel).toBe(false);
  });

  it("Ctrl+F4 (closeTabWin) es un alias de cerrar pestaña en Windows (SPEC-CORE-007 enmienda, PD-94)", () => {
    expect(appConfig.shortcuts.closeTabWin).toBe("Ctrl+F4");
  });
});

describe("fileTypeForPath (BL-125/ADR-013)", () => {
  it("una pestaña sin ruta (nueva) es Markdown, igual que hoy (SPEC-CORE-002)", () => {
    expect(fileTypeForPath(null)).toEqual({ editMode: "markdown" });
  });

  it(".md y .markdown son editMode markdown, sin cambiar comportamiento (refactor interno)", () => {
    expect(fileTypeForPath("C:/notas/a.md")).toEqual({ editMode: "markdown" });
    expect(fileTypeForPath("C:/notas/a.MARKDOWN")).toEqual({ editMode: "markdown" });
  });

  it(".txt sigue siendo editMode code sin resaltado, igual que hoy", () => {
    expect(fileTypeForPath("C:/notas/a.txt")).toEqual({ editMode: "code" });
  });

  it("los seis tipos de PD-90 resuelven a editMode code con su paquete de lenguaje", () => {
    expect(fileTypeForPath("a.py")).toEqual({ editMode: "code", languagePackage: "@codemirror/lang-python" });
    expect(fileTypeForPath("a.json")).toEqual({ editMode: "code", languagePackage: "@codemirror/lang-json" });
    expect(fileTypeForPath("a.js")).toEqual({ editMode: "code", languagePackage: "@codemirror/lang-javascript" });
    expect(fileTypeForPath("a.ts")).toEqual({ editMode: "code", languagePackage: "@codemirror/lang-javascript" });
    expect(fileTypeForPath("a.yaml")).toEqual({ editMode: "code", languagePackage: "@codemirror/lang-yaml" });
    expect(fileTypeForPath("a.yml")).toEqual({ editMode: "code", languagePackage: "@codemirror/lang-yaml" });
    expect(fileTypeForPath("a.css")).toEqual({ editMode: "code", languagePackage: "@codemirror/lang-css" });
    expect(fileTypeForPath("a.html")).toEqual({ editMode: "code", languagePackage: "@codemirror/lang-html" });
  });

  it("una extensión desconocida cae a texto plano, nunca bloquea abrir el archivo", () => {
    expect(fileTypeForPath("a.xyz")).toEqual({ editMode: "code" });
  });

  it("la extensión es insensible a mayúsculas/minúsculas", () => {
    expect(fileTypeForPath("A.PY")).toEqual({ editMode: "code", languagePackage: "@codemirror/lang-python" });
  });
});
