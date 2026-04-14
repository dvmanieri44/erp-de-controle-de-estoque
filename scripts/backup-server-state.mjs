import { cp, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";

const sourceDir = path.join(process.cwd(), ".data");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const destinationDir = path.join(process.cwd(), ".backups", timestamp);

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await pathExists(sourceDir))) {
    console.log("Nenhum estado local encontrado em .data para backup.");
    return;
  }

  await mkdir(destinationDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    await cp(sourcePath, destinationPath, { recursive: true, force: true });
  }

  console.log(`Backup local concluido em ${destinationDir}`);
}

main().catch((error) => {
  console.error("Falha ao gerar o backup local do estado do servidor.");
  console.error(error);
  process.exitCode = 1;
});
