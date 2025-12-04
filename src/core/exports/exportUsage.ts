import { normalizeFilePath } from "../fileSystem/normalizePath";
import type { ImportRecord } from "../imports/buildImportGraph";
import { resolveExportGraph } from "./resolveExportGraph";
import type { ExportInfo } from "./scanExports";

interface ExportUsageResult {
  used: Record<string, Set<string>>;
  unused: Record<string, Set<string>>;
}

/**
 * Determine which exported symbols are actually used across the project.
 *
 * Uses:
 *   - Raw per-file export data (`exportMap`)
 *   - Fully resolved export graph (re-exports + aliasing)
 *   - Import graph
 */
export function analyzeExportUsage(
  exportMap: Record<string, ExportInfo>,
  importGraph: Record<string, ImportRecord[]>,
): ExportUsageResult {
  const allFiles = Object.keys(exportMap);

  // Map normalized paths → canonical exportMap keys
  const canonicalByNormalized = new Map<string, string>();
  for (const file of allFiles) {
    canonicalByNormalized.set(normalizeFilePath(file), file);
  }

  function resolveToCanonical(pathOrSpec: string): string | null {
    return canonicalByNormalized.get(normalizeFilePath(pathOrSpec)) ?? null;
  }

  // Precompute resolved exports (re-exports, wildcard chains, etc.)
  const resolvedExportsByFile = resolveExportGraph(exportMap, allFiles);

  // used[file] → Set<exportName>
  const used: Record<string, Set<string>> = {};
  for (const file of allFiles) used[file] = new Set();

  function markUsed(file: string, name: string) {
    used[file]?.add(name);
  }

  // Match imports to resolved export entries
  for (const [, importEdges] of Object.entries(importGraph)) {
    for (const edge of importEdges) {
      const targetFile = resolveToCanonical(edge.sourceFile);
      if (!targetFile) continue; // skip bare/unresolved imports

      const resolved = resolvedExportsByFile[targetFile];
      if (!resolved || resolved.length === 0) continue;

      const defaultExport = resolved.find((e) => e.isDefault || e.name === "default");

      // Wildcard import → everything is used
      if (edge.imported.includes("*")) {
        for (const entry of resolved) {
          markUsed(targetFile, entry.name);
          markUsed(entry.sourceFile, entry.originalName);
        }
        continue;
      }

      // Default import
      if (edge.imported.includes("default") && defaultExport) {
        markUsed(targetFile, defaultExport.name);
        markUsed(defaultExport.sourceFile, defaultExport.originalName);
      }

      // Named imports
      for (const imported of edge.imported) {
        if (imported === "default" || imported === "*") continue;

        const entry = resolved.find((e) => e.name === imported);
        if (!entry) continue;

        markUsed(targetFile, entry.name);
        markUsed(entry.sourceFile, entry.originalName);
      }
    }
  }

  // Determine unused exports: declared but never marked as used
  const unused: Record<string, Set<string>> = {};

  for (const file of allFiles) {
    const info = exportMap[file];
    const usedInFile = used[file];
    const missing = new Set<string>();

    if (info.default && !usedInFile.has("default")) {
      missing.add("default");
    }
    for (const name of info.named) {
      if (!usedInFile.has(name)) missing.add(name);
    }

    unused[file] = missing;
  }

  return { used, unused };
}
