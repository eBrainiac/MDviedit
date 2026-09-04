/**
 * pnpm measure:bundle — BL-043 / MEM-007/008: suma el peso gzip de todo el
 * JS que SvelteKit emite en `build/` (frontendDist, ver adapter-static +
 * tauri.conf.json) y lo compara contra el presupuesto de NFR-008
 * (≤ 900 KB gzip). Corre después de `pnpm build` (ver package.json).
 *
 * No mide RAM (NFR-001/002): eso requiere el binario nativo corriendo y
 * el Administrador de tareas / Activity Monitor, ver `measure-ram-fixtures.ts`
 * y el procedimiento manual reportado en la conversación (CLAUDE.md: los
 * reportes de aceptación no viven como archivos en este repo).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const BUNDLE_BUDGET_GZIP_BYTES = 900 * 1024; // NFR-008
const BYTES_PER_KB = 1024;

const buildDir = fileURLToPath(new URL("../build", import.meta.url));

function collectJsFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectJsFiles(full));
    } else if (entry.endsWith(".js")) {
      files.push(full);
    }
  }
  return files;
}

function main(): void {
  let jsFiles: string[];
  try {
    jsFiles = collectJsFiles(buildDir);
  } catch {
    console.error(`No se encontró '${buildDir}'. Corre 'pnpm build' antes de medir.`);
    process.exitCode = 1;
    return;
  }

  let totalGzipBytes = 0;
  const perFile: { path: string; gzipBytes: number }[] = [];

  for (const file of jsFiles) {
    const contents = readFileSync(file);
    const gzipBytes = gzipSync(contents).byteLength;
    totalGzipBytes += gzipBytes;
    perFile.push({ path: file.slice(buildDir.length + 1), gzipBytes });
  }

  perFile.sort((a, b) => b.gzipBytes - a.gzipBytes);

  console.log(`Archivos JS medidos: ${jsFiles.length}`);
  console.log("Mayores contribuyentes (gzip):");
  for (const { path, gzipBytes } of perFile.slice(0, 10)) {
    console.log(`  ${(gzipBytes / BYTES_PER_KB).toFixed(1)} KB  ${path}`);
  }

  const totalKb = (totalGzipBytes / BYTES_PER_KB).toFixed(1);
  const budgetKb = (BUNDLE_BUDGET_GZIP_BYTES / BYTES_PER_KB).toFixed(0);
  console.log(`\nTotal JS gzip: ${totalKb} KB (presupuesto NFR-008: ${budgetKb} KB)`);

  if (totalGzipBytes > BUNDLE_BUDGET_GZIP_BYTES) {
    console.error(`FUERA DE PRESUPUESTO por ${((totalGzipBytes - BUNDLE_BUDGET_GZIP_BYTES) / BYTES_PER_KB).toFixed(1)} KB.`);
    process.exitCode = 1;
  } else {
    console.log("Dentro de presupuesto (AT-064).");
  }
}

main();
