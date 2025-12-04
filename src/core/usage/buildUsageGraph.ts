import ts from "typescript";

import { analyzeExportUsage } from "../exports/exportUsage";
import type { ExportInfo } from "../exports/scanExports";
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
  const trimmedText = fileText.trim();
  const nonEmptyLines = trimmedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // export-only → assumed pure
  if (nonEmptyLines.length > 0 && nonEmptyLines.every((line) => line.startsWith("export "))) {
    return false;
  }

  // simple heuristics
  if (/\bsetTimeout\s*\(/.test(trimmedText)) return true;
  if (/\bsetInterval\s*\(/.test(trimmedText)) return true;
  if (/\bconsole\.[a-zA-Z]+\s*\(/.test(trimmedText)) return true;
  if (/\bprocess\./.test(trimmedText)) return true;
  if (/\bnew\s+[A-Za-z_$]/.test(trimmedText)) return true;
  if (/^\s*\(/.test(trimmedText)) return true; // IIFE

  return false;
}

// Returns true if a module contains any kind of export.
function fileExportsAnything(exportInfo: ExportInfo): boolean {
  return (
    exportInfo.named.length > 0 ||
    exportInfo.default === true ||
    exportInfo.namedReexports.length > 0 ||
    exportInfo.wildcardReexports.length > 0
  );
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
  const { used: usedExportsByFile, unused: unusedExportsByFile } = analyzeExportUsage(
    exportMap,
    importGraph,
  );

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
  const unusedFiles: string[] = [];

  for (const filePath of filePaths) {
    const exportInfo = exportMap[filePath];
    if (!exportInfo) continue;

    const importRecords = importGraph[filePath] ?? [];
    const moduleHasExports = fileExportsAnything(exportInfo);
    const moduleHasImports = importRecords.length > 0;

    const usedExportsInFile = usedExportsByFile[filePath] ?? new Set<string>();
    const moduleExportsAreUsed = usedExportsInFile.size > 0;

    if (!moduleHasExports) continue;
    if (moduleExportsAreUsed) continue;
    if (moduleHasImports) continue;

    const fileText = getSourceText(filePath) ?? "";
    if (hasSideEffects(filePath, fileText)) continue;

    unusedFiles.push(filePath);
  }

  return {
    unusedExports,
    unusedFiles,
    unusedIdentifiers,
  };
}
