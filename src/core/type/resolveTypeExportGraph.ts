import path from "node:path";
import { intern } from "../../utils";
import { normalizeFilePath } from "../fileSystem/normalizePath";
import type { TypeExportInfo } from "./scanTypeExports";

export interface ResolvedTypeExportEntry {
  name: string; // Final exported name
  originalName: string; // Source module's exported name
  sourceFile: string; // File where type is originally declared
  exportChain: string[]; // Files involved in re-exporting
}

type ResolvedMap = Record<string, ResolvedTypeExportEntry[]>;

function resolveTarget(reexportingFile: string, spec: string, allFiles: string[]): string | null {
  const dir = path.dirname(reexportingFile);
  const base = path.resolve(dir, spec);

  const candidates = [
    base,
    base + ".ts",
    base + ".tsx",
    base + ".js",
    base + ".jsx",
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.js"),
    path.join(base, "index.jsx"),
  ].map(normalizeFilePath);

  for (const candidate of candidates) {
    const match = allFiles.find((file) => normalizeFilePath(file) === candidate);

    if (match) return match;
  }

  return null;
}

export function resolveTypeExportGraph(
  typeExportMap: Record<string, TypeExportInfo>,
  allFiles: string[],
): ResolvedMap {
  const fileCache = new Map<string, ResolvedTypeExportEntry[]>();
  const resolving = new Set<string>();

  function resolveFile(file: string): ResolvedTypeExportEntry[] {
    if (fileCache.has(file)) return fileCache.get(file)!;
    if (resolving.has(file)) return fileCache.get(file) ?? [];

    resolving.add(file);

    const info = typeExportMap[file];

    if (!info) {
      fileCache.set(file, []);
      resolving.delete(file);

      return [];
    }

    // Map of name -> entry with priority for conflict resolution
    const table = new Map<string, { entry: ResolvedTypeExportEntry; priority: number }>();

    // Wildcard reexports
    for (const spec of info.wildcardReexports) {
      const target = resolveTarget(file, spec, allFiles);

      if (!target) continue;

      for (const entry of resolveFile(target)) {
        const existing = table.get(entry.name);
        const priority = 1;

        if (!existing || priority >= existing.priority) {
          table.set(entry.name, {
            priority,
            entry: {
              name: intern(entry.name),
              originalName: intern(entry.originalName),
              sourceFile: entry.sourceFile,
              exportChain: [file, ...entry.exportChain],
            },
          });
        }
      }
    }

    // Named re-exports
    for (const namedReexports of info.namedReexports) {
      const target = resolveTarget(file, namedReexports.from, allFiles);

      if (!target) continue;

      const resolved = resolveFile(target);
      const matched = resolved.find((entry) => entry.name === namedReexports.name);

      if (!matched) continue;

      const existing = table.get(namedReexports.as);
      const priority = 2;

      if (!existing || priority >= existing.priority) {
        table.set(namedReexports.as, {
          priority,
          entry: {
            name: intern(namedReexports.as),
            originalName: intern(matched.originalName),
            sourceFile: matched.sourceFile,
            exportChain: [file, ...matched.exportChain],
          },
        });
      }
    }

    // Local exported types
    for (const localType of info.localExported) {
      const existing = table.get(localType);
      const priority = 3;

      if (!existing || priority >= existing.priority) {
        table.set(localType, {
          priority,
          entry: {
            name: intern(localType),
            originalName: intern(localType),
            sourceFile: file,
            exportChain: [],
          },
        });
      }
    }

    const out = [...table.values()].map((value) => value.entry);

    fileCache.set(file, out);
    resolving.delete(file);

    return out;
  }

  const result: ResolvedMap = {};

  for (const file of allFiles) result[file] = resolveFile(file);

  return result;
}
