/**
 * Detects project entry points such as:
 *   • package.json main/module/types/bin targets
 *   • conventional roots (index.ts, src/index.ts)
 *
 * These act as graph roots for reachability analysis.
 * No filesystem traversal or AST parsing happens here.
 */

import fs from "node:fs";
import path from "node:path";
import { normalizeFilePath } from "../fileSystem/normalizePath";

export interface EntryPointInfo {
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

function resolveFromPackageJson(projectRoot: string, projectFiles: Set<string>): Set<string> {
  const entryPoints = new Set<string>();

  const pkgPath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(pkgPath)) return entryPoints;

  let pkg: any;

  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  } catch {
    return entryPoints;
  }

  const candidatePaths: string[] = [];

  // package.json fields
  if (typeof pkg.main === "string") candidatePaths.push(pkg.main);
  if (typeof pkg.module === "string") candidatePaths.push(pkg.module);
  if (typeof pkg.types === "string") candidatePaths.push(pkg.types);
  if (typeof pkg.typings === "string") candidatePaths.push(pkg.typings);

  // package.json bin - string or object
  if (typeof pkg.bin === "string") {
    candidatePaths.push(pkg.bin);
  } else if (pkg.bin && typeof pkg.bin === "object") {
    for (const value of Object.values(pkg.bin)) {
      if (typeof value === "string") candidatePaths.push(value);
    }
  }

  // exports: string | object | nested conditions | arrays
  candidatePaths.push(...collectExportsTargets(pkg.exports));

  for (const rawCandidate of candidatePaths) {
    const resolved = resolveCandidateToProjectFile(projectRoot, rawCandidate, projectFiles);

    if (resolved) entryPoints.add(resolved);
  }

  return entryPoints;
}

function collectExportsTargets(exportsField: unknown): string[] {
  const targets: string[] = [];

  function walk(value: unknown) {
    if (value == null) return;

    if (typeof value === "string") {
      targets.push(value);

      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) walk(item);

      return;
    }

    if (typeof value === "object") {
      for (const propVal of Object.values(value as Record<string, unknown>)) {
        walk(propVal);
      }
    }
  }

  walk(exportsField);

  return targets;
}

function resolveCandidateToProjectFile(
  projectRoot: string,
  candidatePath: string,
  projectFiles: Set<string>,
): string | null {
  const absoluteCandidate = normalizeFilePath(path.resolve(projectRoot, candidatePath));

  if (projectFiles.has(absoluteCandidate)) return absoluteCandidate;

  const resolvedByExt = trySwapExtensions(absoluteCandidate, projectFiles);
  if (resolvedByExt) return resolvedByExt;

  const resolvedByDistSrc = tryDistToSrcMapping(absoluteCandidate, projectFiles);
  if (resolvedByDistSrc) return resolvedByDistSrc;

  return null;
}

function trySwapExtensions(absoluteCandidate: string, projectFiles: Set<string>): string | null {
  const fromExtensions = [".js", ".jsx", ".mjs", ".cjs"];
  const toExtensions = [".ts", ".tsx"];

  for (const fromExt of fromExtensions) {
    if (!absoluteCandidate.endsWith(fromExt)) continue;

    const base = absoluteCandidate.slice(0, -fromExt.length);

    for (const toExt of toExtensions) {
      const tsCandidate = `${base}${toExt}`;

      if (projectFiles.has(tsCandidate)) return tsCandidate;
    }
  }

  return null;
}

function tryDistToSrcMapping(absoluteCandidate: string, projectFiles: Set<string>): string | null {
  if (!absoluteCandidate.includes("/dist/")) return null;

  const srcCandidate = absoluteCandidate.replace("/dist/", "/src/");
  if (projectFiles.has(srcCandidate)) return srcCandidate;

  const resolvedByExt = trySwapExtensions(srcCandidate, projectFiles);
  if (resolvedByExt) return resolvedByExt;

  return null;
}

function resolveFromConventions(projectRoot: string, projectFiles: Set<string>): Set<string> {
  const entryPoints = new Set<string>();

  const conventionalCandidates = [
    path.join(projectRoot, "index.ts"),
    path.join(projectRoot, "index.tsx"),
    path.join(projectRoot, "src", "index.ts"),
    path.join(projectRoot, "src", "index.tsx"),
    path.join(projectRoot, "src", "main.ts"),
    path.join(projectRoot, "src", "main.tsx"),
  ];

  for (const candidate of conventionalCandidates) {
    const normalized = normalizeFilePath(candidate);

    if (projectFiles.has(normalized)) entryPoints.add(normalized);
  }

  return entryPoints;
}
