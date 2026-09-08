import { describe, expect, it } from "vitest";
import { diffLines } from "./text-diff";

describe("diffLines (BL-115/AT-098)", () => {
  it("identical text produces only unchanged lines", () => {
    const result = diffLines("a\nb\nc", "a\nb\nc");
    expect(result.every((line) => line.kind === "unchanged")).toBe(true);
  });

  it("detects an added line", () => {
    const result = diffLines("a\nc", "a\nb\nc");
    expect(result).toEqual([
      { kind: "unchanged", text: "a" },
      { kind: "added", text: "b" },
      { kind: "unchanged", text: "c" },
    ]);
  });

  it("detects a removed line", () => {
    const result = diffLines("a\nb\nc", "a\nc");
    expect(result).toEqual([
      { kind: "unchanged", text: "a" },
      { kind: "removed", text: "b" },
      { kind: "unchanged", text: "c" },
    ]);
  });

  it("empty before is a full addition", () => {
    const result = diffLines("", "hola");
    expect(result.some((line) => line.kind === "added")).toBe(true);
  });

  it("falls back to whole-file replacement above aiDiffMaxLines", () => {
    const before = Array.from({ length: 2001 }, (_, i) => `línea vieja ${i}`).join("\n");
    const after = Array.from({ length: 2001 }, (_, i) => `línea nueva ${i}`).join("\n");
    const result = diffLines(before, after);
    expect(result.every((line) => line.kind !== "unchanged")).toBe(true);
    expect(result.filter((line) => line.kind === "removed")).toHaveLength(2001);
    expect(result.filter((line) => line.kind === "added")).toHaveLength(2001);
  });
});
