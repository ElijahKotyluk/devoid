import path from "node:path";
import { normalizeFilePath } from "../fileSystem/normalizePath";
import type { ImportRecord } from "../imports/buildImportGraph";
import { resolveExportGraph } from "../exports/resolveExportGraph";
import type { ExportInfo } from "../exports/scanExports";

export interface ExplainResult {
  target: string;
  exportName?: string;
  status: "used" | "unused" | "not-found";
  importedBy: { file: string; symbols: string[] }[];
  reexportChain: string[];
}

/**
 * Explain why a file or export is considered used/unused.
 *
 * Shows:
 *   - Which files import the target
 *   - What symbols they import
 *   - Re-export chain if the export flows through barrels
 */
export function explainUsage(
  target: string,
  exportName: string | undefined,
  exportMap: Record<string, ExportInfo>,
  importGraph: Record<string, ImportRecord[]>,
): ExplainResult {
  const allFiles = Object.keys(exportMap);

  // Normalize target for matching
  const normalizedTarget = normalizeFilePath(path.resolve(target));
  const matchedFile = allFiles.find((f) => normalizeFilePath(f) === normalizedTarget);

  if (!matchedFile) {
    return {
      target: normalizedTarget,
      exportName,
      status: "not-found",
      importedBy: [],
      reexportChain: [],
    };
  }

  const resolvedExports = resolveExportGraph(exportMap, allFiles);

  // Find who imports this file
  const importedBy: { file: string; symbols: string[] }[] = [];

  for (const [importerFile, edges] of Object.entries(importGraph)) {
    for (const edge of edges) {
      const edgeNormalized = normalizeFilePath(edge.sourceFile);
      if (edgeNormalized !== normalizedTarget) continue;

      // If asking about a specific export, filter to relevant imports
      if (exportName) {
        const relevantSymbols = edge.imported.filter((sym) => {
          if (sym === "*") return true;
          if (sym === exportName) return true;
          // Check if the imported symbol maps to our export via re-exports
          const resolved = resolvedExports[matchedFile];
          if (resolved) {
            const entry = resolved.find((e) => e.name === sym);
            if (entry && entry.originalName === exportName && entry.sourceFile === matchedFile) {
              return true;
            }
          }
          return false;
        });

        if (relevantSymbols.length > 0) {
          importedBy.push({ file: importerFile, symbols: relevantSymbols });
        }
      } else {
        importedBy.push({ file: importerFile, symbols: edge.imported });
      }
    }
  }

  // Find re-export chain if this export flows through barrels
  let reexportChain: string[] = [];
  if (exportName) {
    const resolved = resolvedExports[matchedFile];
    if (resolved) {
      const entry = resolved.find((e) => e.name === exportName);
      if (entry && entry.exportChain.length > 0) {
        reexportChain = entry.exportChain;
      }
    }

    // Also check if other files re-export this symbol from our file
    for (const [file, entries] of Object.entries(resolvedExports)) {
      if (file === matchedFile) continue;
      for (const entry of entries) {
        if (entry.sourceFile === matchedFile && entry.originalName === exportName) {
          // This file re-exports our target — check if anyone imports from it
          for (const [importerFile, edges] of Object.entries(importGraph)) {
            for (const edge of edges) {
              if (normalizeFilePath(edge.sourceFile) === normalizeFilePath(file)) {
                if (edge.imported.includes(entry.name) || edge.imported.includes("*")) {
                  importedBy.push({
                    file: importerFile,
                    symbols: [entry.name + " (via " + path.basename(file) + ")"],
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  const isUsed = importedBy.length > 0;

  return {
    target: matchedFile,
    exportName,
    status: isUsed ? "used" : "unused",
    importedBy,
    reexportChain,
  };
}
