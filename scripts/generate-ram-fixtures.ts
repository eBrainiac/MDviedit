/**
 * pnpm measure:ram-fixtures — BL-043 / MEM-007: prepara los archivos que
 * pide AT-060/AT-061 para medir RAM manualmente (NFR-001/002). La propia
 * medición NO se automatiza aquí: AT-060/061 la definen como lectura del
 * Administrador de tareas / Activity Monitor con la app corriendo, algo que
 * este script no puede hacer de forma portable ni fiable. Lo que sí hace:
 * generar los .md de los tamaños exactos que piden los AT, en una carpeta
 * temporal fuera del repo, lista para abrir desde "Abrir" en la app.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BYTES_PER_KB = 1024;
const AT060_TARGET_KB = 50; // AT-060 / NFR-001: 1 archivo de 50 KB
const AT061_FILE_COUNT = 20; // AT-061 / NFR-002: 20 pestañas
const AT061_TARGET_KB = 150; // AT-061 exige ≤ 200 KB cada uno; 150 deja margen

const PARAGRAPH =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Este párrafo de relleno " +
  "se repite para alcanzar el tamaño de archivo objetivo de la prueba de RAM (AT-060/061).\n\n";

function buildMarkdown(targetKb: number, title: string): string {
  const targetBytes = targetKb * BYTES_PER_KB;
  let content = `# ${title}\n\n`;
  while (Buffer.byteLength(content, "utf-8") < targetBytes) content += PARAGRAPH;
  return content;
}

function main(): void {
  const outDir = join(tmpdir(), "mdviedit-ram-fixtures");
  mkdirSync(outDir, { recursive: true });

  const at060Path = join(outDir, "at060-50kb.md");
  writeFileSync(at060Path, buildMarkdown(AT060_TARGET_KB, "AT-060 — RAM en reposo"));

  const at061Paths: string[] = [];
  for (let i = 1; i <= AT061_FILE_COUNT; i += 1) {
    const path = join(outDir, `at061-${String(i).padStart(2, "0")}.md`);
    writeFileSync(path, buildMarkdown(AT061_TARGET_KB, `AT-061 — pestaña ${i}`));
    at061Paths.push(path);
  }

  console.log(`Fixtures generados en: ${outDir}\n`);
  console.log("AT-060 (NFR-001, ≤ 150 MB): abre 1 archivo, espera 30 s, mide RAM del proceso app + WebView:");
  console.log(`  ${at060Path}\n`);
  console.log(`AT-061 (NFR-002, ≤ 250 MB): abre los ${AT061_FILE_COUNT} archivos siguientes en pestañas y mide:`);
  for (const path of at061Paths) console.log(`  ${path}`);
  console.log(
    "\nEn Windows: Administrador de tareas → pestaña Detalles → suma los procesos 'mdviedit.exe'.\n" +
      "En macOS: Activity Monitor → busca 'MDviedit' → suma Memory de todos sus procesos.",
  );
}

main();
