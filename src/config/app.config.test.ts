import { describe, expect, it } from "vitest";
import { appConfig } from "./app.config";

describe("appConfig", () => {
  it("identifica la app según PD-11/PQ-02", () => {
    expect(appConfig.name).toBe("MDviedit");
    expect(appConfig.id).toBe("mx.mdviedit.app");
  });

  it("expone los filtros de archivo de SPEC-CORE-001 (PD-23)", () => {
    expect(appConfig.fileFilters.extensions).toEqual(["md", "markdown", "txt"]);
  });

  it("usa la paleta B y modo sistema por defecto (SPEC-CORE-011)", () => {
    expect(appConfig.preferencesDefaults.palette).toBe("b");
    expect(appConfig.preferencesDefaults.themeMode).toBe("system");
  });
});
