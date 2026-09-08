/**
 * BL-114 / PD-64 / AT-096/097: resumir uno o varios archivos abiertos. Si el
 * contenido total (estimado en tokens, sin tokenizador real —
 * `aiCharsPerTokenEstimate`) no cabe en el contexto del backend activo, se
 * resume archivo por archivo y se combinan los resúmenes parciales en uno
 * final (map-reduce), en vez de truncar en silencio o fallar. `sendMessage`
 * se inyecta para que esta lógica sea testable sin backend real — mismo
 * criterio que `recent-files-open.ts` en IT-8.
 */
import { appConfig } from "../../config/app.config";

export interface SummarizableFile {
  readonly path: string;
  readonly title: string;
  readonly text: string;
}

export type SendMessageFn = (prompt: string) => Promise<string>;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / appConfig.behavior.aiCharsPerTokenEstimate);
}

function joinFiles(files: readonly SummarizableFile[]): string {
  return files.map((file) => `# ${file.title}\n\n${file.text}`).join("\n\n---\n\n");
}

/**
 * `true` si el contenido combinado de `files` cabe en `contextTokenLimit`
 * sin necesitar map-reduce (AT-096: caso simple, un solo archivo o varios
 * que caben juntos).
 */
export function fitsInSingleRequest(files: readonly SummarizableFile[], contextTokenLimit: number): boolean {
  const totalTokens = files.reduce((sum, file) => sum + estimateTokens(file.text), 0);
  return totalTokens <= Math.floor(contextTokenLimit * appConfig.behavior.aiContextBudgetFraction);
}

export async function summarizeFiles(
  files: readonly SummarizableFile[],
  contextTokenLimit: number,
  sendMessage: SendMessageFn,
): Promise<string> {
  if (files.length === 0) return "";

  if (files.length === 1 || fitsInSingleRequest(files, contextTokenLimit)) {
    return sendMessage(`Resume el siguiente contenido de forma clara y concisa:\n\n${joinFiles(files)}`);
  }

  // Map: un resumen por archivo.
  const partials: string[] = [];
  for (const file of files) {
    const summary = await sendMessage(
      `Resume el siguiente archivo ("${file.title}") de forma clara y concisa:\n\n${file.text}`,
    );
    partials.push(`# ${file.title}\n\n${summary}`);
  }

  // Reduce: combina los resúmenes parciales en uno solo.
  return sendMessage(
    `Combina los siguientes resúmenes parciales en un único resumen final coherente:\n\n${partials.join("\n\n---\n\n")}`,
  );
}
