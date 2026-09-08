/**
 * BL-115 / PD-58 / AT-098: diff antes/después del cambio propuesto por el
 * Chat de IA, antes de confirmarlo. UI-SCREENS §10 no fija un algoritmo de
 * diff concreto — LCS línea a línea, con un tope de tamaño (`MAX_DIFF_LINES`)
 * para no pagar el costo O(n*m) en archivos grandes: por encima del tope se
 * reporta como reemplazo completo (todo quitado + todo puesto), que sigue
 * siendo un diff correcto, solo menos granular.
 */
import { appConfig } from "../../config/app.config";

export type DiffLineKind = "unchanged" | "added" | "removed";

export interface DiffLine {
  readonly kind: DiffLineKind;
  readonly text: string;
}

function wholeFileReplacement(beforeLines: readonly string[], afterLines: readonly string[]): DiffLine[] {
  return [
    ...beforeLines.map((text) => ({ kind: "removed" as const, text })),
    ...afterLines.map((text) => ({ kind: "added" as const, text })),
  ];
}

export function diffLines(before: string, after: string): DiffLine[] {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const maxLines = appConfig.behavior.aiDiffMaxLines;
  if (beforeLines.length > maxLines || afterLines.length > maxLines) {
    return wholeFileReplacement(beforeLines, afterLines);
  }

  const m = beforeLines.length;
  const n = afterLines.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] =
        beforeLines[i] === afterLines[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (beforeLines[i] === afterLines[j]) {
      result.push({ kind: "unchanged", text: beforeLines[i] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      result.push({ kind: "removed", text: beforeLines[i] });
      i += 1;
    } else {
      result.push({ kind: "added", text: afterLines[j] });
      j += 1;
    }
  }
  while (i < m) {
    result.push({ kind: "removed", text: beforeLines[i] });
    i += 1;
  }
  while (j < n) {
    result.push({ kind: "added", text: afterLines[j] });
    j += 1;
  }
  return result;
}
