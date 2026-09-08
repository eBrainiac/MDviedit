/**
 * BL-114 / PD-64 / AT-096/097. `sendMessage` está mockeado — esta prueba
 * cubre la lógica de decisión (single request vs. map-reduce) y el orden de
 * llamadas, no un backend real.
 */
import { describe, expect, it, vi } from "vitest";
import { estimateTokens, fitsInSingleRequest, summarizeFiles, type SummarizableFile } from "./summarize";

function file(title: string, text: string): SummarizableFile {
  return { path: title, title, text };
}

describe("estimateTokens/fitsInSingleRequest", () => {
  it("estimates roughly chars/4 tokens", () => {
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });

  it("a single small file fits in a small context", () => {
    expect(fitsInSingleRequest([file("a.md", "hola")], 1000)).toBe(true);
  });

  it("content larger than the budget does not fit", () => {
    expect(fitsInSingleRequest([file("a.md", "x".repeat(10_000))], 1000)).toBe(false);
  });
});

describe("summarizeFiles (AT-096/097)", () => {
  it("one file: a single request, no map-reduce", async () => {
    const sendMessage = vi.fn(async () => "resumen único");
    const result = await summarizeFiles([file("a.md", "contenido corto")], 100_000, sendMessage);
    expect(result).toBe("resumen único");
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("several small files that fit together: a single combined request", async () => {
    const sendMessage = vi.fn(async () => "resumen combinado");
    const files = [file("a.md", "corto a"), file("b.md", "corto b")];
    const result = await summarizeFiles(files, 100_000, sendMessage);
    expect(result).toBe("resumen combinado");
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("content exceeding the context limit triggers map-reduce: per-file summaries + one combining call", async () => {
    const calls: string[] = [];
    const sendMessage = vi.fn(async (prompt: string) => {
      calls.push(prompt);
      return `resumen de: ${prompt.slice(0, 10)}`;
    });
    const files = [file("a.md", "x".repeat(5000)), file("b.md", "y".repeat(5000))];
    // Contexto pequeño a propósito para forzar el camino map-reduce.
    const result = await summarizeFiles(files, 1000, sendMessage);
    // 2 resúmenes parciales (map) + 1 de combinación (reduce) = 3 llamadas.
    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(calls[0]).toContain("a.md");
    expect(calls[1]).toContain("b.md");
    expect(result).toContain("resumen de:");
  });

  it("no files returns an empty string without calling sendMessage", async () => {
    const sendMessage = vi.fn(async () => "no debería llamarse");
    const result = await summarizeFiles([], 100_000, sendMessage);
    expect(result).toBe("");
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
