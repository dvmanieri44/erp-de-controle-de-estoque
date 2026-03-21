import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_FOLDERS = ["app", "components", "lib"];
const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

function collectFiles(dirPath) {
  const entries = readdirSync(dirPath);
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    if (stats.isFile() && [...SCAN_EXTENSIONS].some((ext) => fullPath.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

function buildDuplicatesMap(files) {
  const hashes = new Map();

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const hash = createHash("sha1").update(content).digest("hex");
    const current = hashes.get(hash) ?? [];
    current.push(file);
    hashes.set(hash, current);
  }

  return [...hashes.values()].filter((paths) => paths.length > 1);
}

function run() {
  const allFiles = SCAN_FOLDERS.filter((folder) => existsSync(join(ROOT, folder))).flatMap((folder) =>
    collectFiles(join(ROOT, folder)),
  );

  const duplicateGroups = buildDuplicatesMap(allFiles);

  if (duplicateGroups.length === 0) {
    console.log("Quality Agent: nenhum arquivo duplicado encontrado.");
    process.exit(0);
  }

  console.error("Quality Agent: duplicacoes encontradas.");
  for (const group of duplicateGroups) {
    const readableGroup = group.map((path) => relative(ROOT, path));
    console.error(`- ${readableGroup.join(" == ")}`);
  }
  process.exit(1);
}

run();
