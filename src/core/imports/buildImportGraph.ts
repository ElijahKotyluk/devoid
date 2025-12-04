/**
 * Import Graph Builder
 * --------------------
 *
 * Produces a structural module-import graph for all project files.
 * For each file, we record:
 *
 *   • which module it imports
 *   • how it was imported (default, named, namespace, wildcard)
 *
 * This graph is later consumed by the export-usage analyzer.
 */

import path from "path";
import ts from "typescript";
import { normalizeFilePath } from "../fileSystem/normalizePath";
import { TSConfigInfo } from "../tsconfig/tsconfigLoader";

// Reset per buildImportGraph() call
let importResolutionCache: Map<string, string>;
let fileLookupCache: Map<string, string | null>;

/** Memoization key for importer + module specifier */
function createImportResolutionKey(importerFilePath: string, moduleSpecifier: string): string {
  return `${importerFilePath}\x1F${moduleSpecifier}`;
}

/**
 * A single import edge:
 *
 *   importer → importedModule
 */
export interface ImportRecord {
  sourceFile: string; // resolved path OR bare specifier
  imported: string[]; // ["default"], ["foo"], ["*"], etc.
}

export function buildImportGraph(
  projectFiles: string[],
  tsconfig: TSConfigInfo,
): Record<string, ImportRecord[]> {
  importResolutionCache = new Map();
  fileLookupCache = new Map();

  const importGraph: Record<string, ImportRecord[]> = {};

  for (const filePath of projectFiles) {
    const fileContents = ts.sys.readFile(filePath);
    if (!fileContents) {
      importGraph[filePath] = [];
      continue;
    }

    const sourceFile = ts.createSourceFile(filePath, fileContents, ts.ScriptTarget.ESNext, true);

    const importEdges: ImportRecord[] = [];

    sourceFile.forEachChild((node) => {
      if (!ts.isImportDeclaration(node)) return;

      const importClause = node.importClause ?? undefined;
      if (importClause?.isTypeOnly) return;

      const moduleSpecifier = node.moduleSpecifier.getText().replace(/['"]/g, "");
      const resolvedTargetFile = resolveImportSpecifier(
        filePath,
        moduleSpecifier,
        projectFiles,
        tsconfig,
      );

      const symbols = extractImportedSymbols(node, sourceFile);
      if (symbols.length === 0) return;

      importEdges.push({
        sourceFile: resolvedTargetFile,
        imported: symbols,
      });
    });

    importGraph[filePath] = importEdges;
  }

  return importGraph;
}

// Extract only runtime-relevant imported symbols.
function extractImportedSymbols(
  importNode: ts.ImportDeclaration,
  fileAST: ts.SourceFile,
): string[] {
  const importClause = importNode.importClause;
  const importedSymbols = new Set<string>();

  // import "./polyfill"
  if (!importClause) {
    importedSymbols.add("*");
    return [...importedSymbols];
  }

  if (importClause.name) importedSymbols.add("default");

  const binding = importClause.namedBindings;
  if (binding) {
    if (ts.isNamedImports(binding)) {
      for (const element of binding.elements) {
        if ((element as any).isTypeOnly) continue;
        importedSymbols.add(element.name.getText(fileAST));
      }
    } else if (ts.isNamespaceImport(binding)) {
      importedSymbols.add("*");
    }
  }

  return [...importedSymbols];
}

// Resolve JS/TS module specifier into a project file path where possible.
function resolveImportSpecifier(
  importerFilePath: string,
  moduleSpecifier: string,
  projectFiles: string[],
  tsconfig: TSConfigInfo,
): string {
  const cacheKey = createImportResolutionKey(importerFilePath, moduleSpecifier);
  const cached = importResolutionCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const importerDirectory = path.dirname(importerFilePath);

  // Resolve "./" or "../" relative imports
  if (moduleSpecifier.startsWith(".")) {
    const relativeBasePath = path.resolve(importerDirectory, moduleSpecifier);
    const resolvedFile = lookupProjectFile(relativeBasePath, projectFiles);

    if (resolvedFile) {
      const normalized = normalizeFilePath(resolvedFile);
      importResolutionCache.set(cacheKey, normalized);
      return normalized;
    }
  }

  // TSConfig `paths` aliases
  const aliasTarget = resolveTSConfigAlias(moduleSpecifier, tsconfig, projectFiles);
  if (aliasTarget) {
    const normalized = normalizeFilePath(aliasTarget);
    importResolutionCache.set(cacheKey, normalized);
    return normalized;
  }

  // Bare imports (external deps)
  importResolutionCache.set(cacheKey, moduleSpecifier);
  return moduleSpecifier;
}

// Resolve a TSConfig `paths` alias.
function resolveTSConfigAlias(
  moduleSpecifier: string,
  tsconfig: TSConfigInfo,
  projectFiles: string[],
): string | null {
  if (!tsconfig.paths) return null;

  for (const [aliasPattern, targetPatterns] of Object.entries(tsconfig.paths)) {
    const wildcardIndex = aliasPattern.indexOf("*");

    // Wildcard alias
    if (wildcardIndex !== -1) {
      const prefix = aliasPattern.slice(0, wildcardIndex);
      const suffix = aliasPattern.slice(wildcardIndex + 1);

      const hasPrefix = moduleSpecifier.startsWith(prefix);
      const hasSuffix = moduleSpecifier.endsWith(suffix);
      if (!hasPrefix || !hasSuffix) continue;

      const wildcardContent = moduleSpecifier.slice(
        prefix.length,
        moduleSpecifier.length - suffix.length,
      );

      for (const targetPattern of targetPatterns) {
        const substitutedTarget = targetPattern.replace("*", wildcardContent);
        const absoluteTargetPath = path.resolve(tsconfig.baseUrl ?? "", substitutedTarget);

        const resolvedFile = lookupProjectFile(absoluteTargetPath, projectFiles);
        if (resolvedFile) return resolvedFile;
      }
    }

    // Exact-match alias
    else if (moduleSpecifier === aliasPattern) {
      for (const targetPath of targetPatterns) {
        const absoluteTargetPath = path.resolve(tsconfig.baseUrl ?? "", targetPath);
        const resolvedFile = lookupProjectFile(absoluteTargetPath, projectFiles);
        if (resolvedFile) return resolvedFile;
      }
    }
  }

  return null;
}

// Try resolving a file using multiple extension/index patterns.
function lookupProjectFile(unresolvedBasePath: string, projectFiles: string[]): string | null {
  const cached = fileLookupCache.get(unresolvedBasePath);
  if (cached !== undefined) return cached;

  const candidatePaths = [
    unresolvedBasePath,
    unresolvedBasePath + ".ts",
    unresolvedBasePath + ".tsx",
    unresolvedBasePath + ".js",
    unresolvedBasePath + ".jsx",
    path.join(unresolvedBasePath, "index.ts"),
    path.join(unresolvedBasePath, "index.tsx"),
    path.join(unresolvedBasePath, "index.js"),
    path.join(unresolvedBasePath, "index.jsx"),
  ];

  for (const candidatePath of candidatePaths) {
    const matchingFile = projectFiles.find(
      (projectFile) => path.resolve(projectFile) === path.resolve(candidatePath),
    );

    if (matchingFile) {
      fileLookupCache.set(unresolvedBasePath, matchingFile);
      return matchingFile;
    }
  }

  fileLookupCache.set(unresolvedBasePath, null);
  return null;
}
