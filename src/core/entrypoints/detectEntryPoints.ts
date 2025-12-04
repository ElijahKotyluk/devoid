/**
 * Detects project entry points such as:
 *   • package.json main/module/types/bin targets
 *   • conventional roots (index.ts, src/index.ts)
 *
 * These act as graph roots for reachability analysis.
 * No filesystem traversal or AST parsing happens here.
 */

import fs from "fs";
import path from "path";
import { normalizeFilePath } from "../fileSystem/normalizePath";

interface EntryPointInfo {
  all: Set<string>;
  fromPackageJson: Set<string>;
  fromConventions: Set<string>;
}

export function detectEntryPoints(projectRoot: string, projectFiles: string[]): EntryPointInfo {
  const normalizedFiles = new Set(projectFiles.map(normalizeFilePath));

  const fromPackageJson = resolveFromPackageJson(projectRoot, normalizedFiles);
  const fromConventions = resolveFromConventions(projectRoot, normalizedFiles);

  const all = new Set<string>([...fromPackageJson, ...fromConventions]);

  return { all, fromPackageJson, fromConventions };
}

/**
 * Extract entry points from package.json fields:
 *   main, module, types/typings, bin
 */
function resolveFromPackageJson(projectRoot: string, projectFiles: Set<string>): Set<string> {
  const result = new Set<string>();
  const pkgPath = path.join(projectRoot, "package.json");

  if (!fs.existsSync(pkgPath)) return result;

  let pkg: any;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  } catch {
    return result;
  }

  const candidates: string[] = [];

  if (typeof pkg.main === "string") candidates.push(pkg.main);
  if (typeof pkg.module === "string") candidates.push(pkg.module);
  if (typeof pkg.types === "string") candidates.push(pkg.types);
  if (typeof pkg.typings === "string") candidates.push(pkg.typings);

  if (typeof pkg.bin === "string") {
    candidates.push(pkg.bin);
  } else if (pkg.bin && typeof pkg.bin === "object") {
    for (const value of Object.values<string>(pkg.bin)) {
      if (typeof value === "string") candidates.push(value);
    }
  }

  for (const rel of candidates) {
    const resolved = resolveCandidateToFile(projectRoot, rel, projectFiles);
    if (resolved) result.add(resolved);
  }

  return result;
}

/**
 * Maps a package.json path to a source file when possible.
 * Attempts:
 *   • exact file match
 *   • dist/*.js → src/*.ts mapping
 */
function resolveCandidateToFile(
  projectRoot: string,
  relativePath: string,
  projectFiles: Set<string>,
): string | null {
  const abs = normalizeFilePath(path.resolve(projectRoot, relativePath));

  if (projectFiles.has(abs)) return abs;

  // Basic .js/.jsx → .ts/.tsx mapping
  const jsExts = [".js", ".jsx"];
  const tsExts = [".ts", ".tsx"];

  for (const jsExt of jsExts) {
    if (abs.endsWith(jsExt)) {
      const base = abs.slice(0, -jsExt.length);
      for (const tsExt of tsExts) {
        const tsCandidate = `${base}${tsExt}`;
        if (projectFiles.has(tsCandidate)) return tsCandidate;
      }
    }
  }

  // dist → src heuristic
  if (abs.includes("/dist/")) {
    const srcCandidate = abs.replace("/dist/", "/src/");
    if (projectFiles.has(srcCandidate)) return srcCandidate;
  }

  return null;
}

/**
 * Detect common entry point filenames when package.json does not specify them.
 */
function resolveFromConventions(projectRoot: string, projectFiles: Set<string>): Set<string> {
  const result = new Set<string>();

  const candidates = [
    path.join(projectRoot, "index.ts"),
    path.join(projectRoot, "index.tsx"),
    path.join(projectRoot, "src", "index.ts"),
    path.join(projectRoot, "src", "index.tsx"),
    path.join(projectRoot, "src", "main.ts"),
    path.join(projectRoot, "src", "main.tsx"),
  ];

  for (const abs of candidates) {
    const normalized = normalizeFilePath(abs);
    if (projectFiles.has(normalized)) result.add(normalized);
  }

  return result;
}
