import path from "node:path";
import ts from "typescript";

import { analyzeExportUsage } from "../exports/exportUsage";
import type { ExportInfo } from "../exports/scanExports";
import { normalizeFilePath } from "../fileSystem/normalizePath";
import type { ImportRecord } from "../imports/buildImportGraph";
import { analyzeLocalUsage, type LocalUsageOptions } from "../locals/analyzeLocalUsage";

// Cache file contents to avoid repeated disk reads.
const sourceTextCache = new Map<string, string | null>();

function getSourceText(filePath: string): string | undefined {
  if (sourceTextCache.has(filePath)) {
    const cachedText = sourceTextCache.get(filePath);
    return cachedText === null ? undefined : cachedText;
  }

  const fileContents = ts.sys.readFile(filePath);
  sourceTextCache.set(filePath, fileContents ?? null);
  return fileContents ?? undefined;
}

export interface UsageGraph {
  unusedExports: { file: string; name: string }[];
  unusedFiles: string[];
  unusedIdentifiers: string[];
}

/**
 * Very small heuristic to detect obvious runtime side-effects.
 * Avoids labeling non-pure modules as unused.
 */
function hasSideEffects(_filePath: string, fileText: string): boolean {
  const text = fileText.trim();

  if (!text) return false;

  // export-only → assumed pure
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 0 && lines.every((line) => line.startsWith("export "))) return false;

  const sideEffectPatterns: RegExp[] = [
    /\bsetTimeout\s*\(/,
    /\bsetInterval\s*\(/,
    /\bconsole\.[a-zA-Z]+\s*\(/,
    /\bprocess\./,
    /\bnew\s+[A-Za-z_$][A-Za-z0-9_$]*/,
    /^\s*\(/, // IIFE
  ];

  return sideEffectPatterns.some((regEx) => regEx.test(text));
}

function resolveModuleToProjectFile(
  fromFile: string,
  moduleSpecifier: string,
  projectFilesSet: Set<string>,
): string | null {
  // Follow only relative specifiers; bare specifiers are external deps
  if (!moduleSpecifier.startsWith(".")) return null;

  const baseDir = path.dirname(fromFile);
  const resolvedBase = path.resolve(baseDir, moduleSpecifier);

  const candidates = [
    resolvedBase,
    resolvedBase + ".ts",
    resolvedBase + ".tsx",
    resolvedBase + ".js",
    resolvedBase + ".jsx",
    path.join(resolvedBase, "index.ts"),
    path.join(resolvedBase, "index.tsx"),
    path.join(resolvedBase, "index.js"),
    path.join(resolvedBase, "index.jsx"),
  ].map(normalizeFilePath);

  for (const candidate of candidates) {
    if (projectFilesSet.has(candidate)) return candidate;
  }

  return null;
}

function buildProjectAdjacency(
  filePaths: string[],
  importGraph: Record<string, ImportRecord[]>,
  exportMap: Record<string, ExportInfo>,
): Map<string, Set<string>> {
  const projectFilesSet = new Set(filePaths);
  const fileDependencyGraph = new Map<string, Set<string>>();

  function addEdge(from: string, to: string) {
    if (!projectFilesSet.has(to)) return;

    let set = fileDependencyGraph.get(from);

    if (!set) {
      set = new Set();
      fileDependencyGraph.set(from, set);
    }

    set.add(to);
  }

  // Import edges
  for (const [from, edges] of Object.entries(importGraph)) {
    for (const edge of edges) {
      addEdge(from, edge.sourceFile);
    }
  }

  // Re-export edges (barrel dependencies)
  for (const from of filePaths) {
    const ex = exportMap[from];

    if (!ex) continue;

    for (const spec of ex.wildcardReexports) {
      const to = resolveModuleToProjectFile(from, spec, projectFilesSet);

      if (to) addEdge(from, to);
    }
    for (const nr of ex.namedReexports) {
      const to = resolveModuleToProjectFile(from, nr.from, projectFilesSet);

      if (to) addEdge(from, to);
    }
  }

  // Ensure every file exists as a key (even leaf nodes)
  for (const file of filePaths) {
    if (!fileDependencyGraph.has(file)) fileDependencyGraph.set(file, new Set());
  }

  return fileDependencyGraph;
}

function computeIncomingCounts(adjacentsMap: Map<string, Set<string>>): Map<string, number> {
  const incoming = new Map<string, number>();
  for (const [from, tos] of adjacentsMap.entries()) {
    if (!incoming.has(from)) incoming.set(from, 0);

    for (const to of tos) {
      incoming.set(to, (incoming.get(to) ?? 0) + 1);
    }
  }
  return incoming;
}

function findReachableFromRoots(
  fileDependencyGraph: Map<string, Set<string>>,
  roots: Set<string>,
): Set<string> {
  const visited = new Set<string>();
  const stack = [...roots];

  while (stack.length > 0) {
    const file = stack.pop()!;

    if (visited.has(file)) continue;

    visited.add(file);

    const next = fileDependencyGraph.get(file);
    if (!next) continue;

    for (const to of next) {
      if (!visited.has(to)) stack.push(to);
    }
  }

  return visited;
}

/**
 * Aggregates:
 *   - export usage
 *   - local identifier usage
 *   - unused file inference
 */
export function buildUsageGraph(
  filePaths: string[],
  exportMap: Record<string, ExportInfo>,
  importGraph: Record<string, ImportRecord[]>,
  options: LocalUsageOptions = {},
  _entryPoints: Set<string> = new Set(),
): UsageGraph {
  const { unused: unusedExportsByFile } = analyzeExportUsage(exportMap, importGraph);

  // Collect unused exports
  const unusedExports: { file: string; name: string }[] = [];

  for (const filePath of filePaths) {
    const unusedExportNames = unusedExportsByFile[filePath];
    if (!unusedExportNames) continue;

    for (const exportName of unusedExportNames) {
      unusedExports.push({ file: filePath, name: exportName });
    }
  }

  // Collect unused local identifiers (internal dead code)
  const unusedIdentifiers: string[] = [];

  for (const filePath of filePaths) {
    const fileText = getSourceText(filePath);

    if (!fileText) continue;

    const localUsage = analyzeLocalUsage(filePath, fileText, {
      trackAllLocals: options.trackAllLocals,
    });

    for (const unusedName of localUsage.unused) {
      unusedIdentifiers.push(`${filePath}:${unusedName}`);
    }
  }

  // Detect unused files
  const fileDependencyGraph = buildProjectAdjacency(filePaths, importGraph, exportMap);

  const unusedFiles: string[] = [];

  if (_entryPoints.size === 0) {
    // If no entrypoints are detected we default to orphan detection
    // Mark the files with no incoming edges as unused unless they contain side effects.
    const incoming = computeIncomingCounts(fileDependencyGraph);

    for (const file of filePaths) {
      if ((incoming.get(file) ?? 0) !== 0) continue;

      const fileText = getSourceText(file) ?? "";
      if (hasSideEffects(file, fileText)) continue;

      unusedFiles.push(file);
    }
  } else {
    // Mark files not reachable from entrypoints as unused unless they contain side effects.
    const reachable = findReachableFromRoots(fileDependencyGraph, _entryPoints);

    for (const file of filePaths) {
      if (reachable.has(file)) continue;

      const fileText = getSourceText(file) ?? "";
      if (hasSideEffects(file, fileText)) continue;

      unusedFiles.push(file);
    }
  }

  return {
    unusedExports,
    unusedFiles,
    unusedIdentifiers,
  };
}
