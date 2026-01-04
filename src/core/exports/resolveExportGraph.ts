import path from "node:path";
import { intern } from "../../utils";
import type { ExportInfo } from "./scanExports";

export interface ResolvedExportEntry {
  name: string; // final exported name in this module
  originalName: string; // name declared in source file
  sourceFile: string; // absolute path of declared file
  isDefault: boolean;
  exportChain: string[]; // intermediate modules from this file to source
}

type ResolvedExportMap = Record<string, ResolvedExportEntry[]>;

/**
 * Cache resolved graphs per project.
 * Keyed by the exportMap object identity.
 */
const projectCache = new WeakMap<Record<string, ExportInfo>, ResolvedExportMap>();

// Resolves a re-export target into a file from `allFiles`.
function resolveReexportTarget(
  reexportingFile: string,
  moduleSpecifier: string,
  allFiles: string[],
): string | null {
  const absoluteSpecifierPath = path.resolve(moduleSpecifier);
  const directFileMatch = allFiles.find(
    (filePath) => path.resolve(filePath) === absoluteSpecifierPath,
  );
  if (directFileMatch) return directFileMatch;

  const reexportingDirectory = path.dirname(reexportingFile);
  const resolvedBasePath = path.resolve(reexportingDirectory, moduleSpecifier);

  const candidatePaths = [
    resolvedBasePath,
    resolvedBasePath + ".ts",
    resolvedBasePath + ".tsx",
    resolvedBasePath + ".js",
    resolvedBasePath + ".jsx",
    path.join(resolvedBasePath, "index.ts"),
    path.join(resolvedBasePath, "index.tsx"),
    path.join(resolvedBasePath, "index.js"),
    path.join(resolvedBasePath, "index.jsx"),
  ];

  for (const candidatePath of candidatePaths) {
    const resolvedTarget = allFiles.find(
      (filePath) => path.resolve(filePath) === path.resolve(candidatePath),
    );
    if (resolvedTarget) return resolvedTarget;
  }

  return null;
}

// Resolves all exports for all project files, including re-export chains.
export function resolveExportGraph(
  exportMap: Record<string, ExportInfo>,
  allFiles: string[],
): ResolvedExportMap {
  const cachedGraph = projectCache.get(exportMap);
  if (cachedGraph) return cachedGraph;

  const fileResultCache = new Map<string, ResolvedExportEntry[]>();
  const resolvingStack = new Set<string>();

  type ExportTableEntry = {
    entry: ResolvedExportEntry;
    priority: number; // 1 wildcard, 2 named re-export, 3 local
  };

  function resolveFileExports(currentFile: string): ResolvedExportEntry[] {
    if (fileResultCache.has(currentFile)) return fileResultCache.get(currentFile)!;

    // Prevent infinite cycles in re-export chains
    if (resolvingStack.has(currentFile)) {
      return fileResultCache.get(currentFile) ?? [];
    }

    resolvingStack.add(currentFile);

    const fileExports = exportMap[currentFile];
    if (!fileExports) {
      fileResultCache.set(currentFile, []);
      resolvingStack.delete(currentFile);
      return [];
    }

    const exportTable = new Map<string, ExportTableEntry>();

    // Wildcard re-exports
    for (const wildcardOrigin of fileExports.wildcardReexports) {
      const targetFile = resolveReexportTarget(currentFile, wildcardOrigin, allFiles);
      if (!targetFile) continue;

      for (const resolvedExport of resolveFileExports(targetFile)) {
        if (resolvedExport.isDefault || resolvedExport.name === "default") continue;

        const existing = exportTable.get(resolvedExport.name);
        const priority = 1;

        if (!existing || priority >= existing.priority) {
          exportTable.set(resolvedExport.name, {
            entry: {
              name: intern(resolvedExport.name),
              originalName: intern(resolvedExport.originalName),
              sourceFile: resolvedExport.sourceFile,
              isDefault: false,
              exportChain: [currentFile, ...resolvedExport.exportChain],
            },
            priority,
          });
        }
      }
    }

    // Named re-exports
    for (const reexportInfo of fileExports.namedReexports) {
      const targetFile = resolveReexportTarget(currentFile, reexportInfo.from, allFiles);
      if (!targetFile) continue;

      const targetResolvedEntries = resolveFileExports(targetFile);
      const matchedTarget = targetResolvedEntries.find(
        (exportEntry) => exportEntry.name === reexportInfo.name,
      );
      if (!matchedTarget) continue;

      const existing = exportTable.get(reexportInfo.as);
      const priority = 2;

      if (!existing || priority >= existing.priority) {
        exportTable.set(reexportInfo.as, {
          entry: {
            name: intern(reexportInfo.as),
            originalName: intern(matchedTarget.originalName),
            sourceFile: matchedTarget.sourceFile,
            isDefault: matchedTarget.isDefault,
            exportChain: [currentFile, ...matchedTarget.exportChain],
          },
          priority,
        });
      }
    }

    // Local exports
    for (const localName of fileExports.named) {
      const existing = exportTable.get(localName);
      const priority = 3;

      if (!existing || priority >= existing.priority) {
        exportTable.set(localName, {
          entry: {
            name: intern(localName),
            originalName: intern(localName),
            sourceFile: currentFile,
            isDefault: false,
            exportChain: [],
          },
          priority,
        });
      }
    }

    if (fileExports.default) {
      const existing = exportTable.get("default");
      const priority = 3;

      if (!existing || priority >= existing.priority) {
        exportTable.set("default", {
          entry: {
            name: intern("default"),
            originalName: intern("default"),
            sourceFile: currentFile,
            isDefault: true,
            exportChain: [],
          },
          priority,
        });
      }
    }

    const fileResolvedExports = [...exportTable.values()].map((t) => t.entry);
    fileResultCache.set(currentFile, fileResolvedExports);
    resolvingStack.delete(currentFile);
    return fileResolvedExports;
  }

  const completeGraph: ResolvedExportMap = {};
  for (const filePath of allFiles) {
    completeGraph[filePath] = resolveFileExports(filePath);
  }

  projectCache.set(exportMap, completeGraph);
  return completeGraph;
}
