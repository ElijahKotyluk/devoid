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

import ts from "typescript";
import { normalizeFilePath } from "../fileSystem/normalizePath";
import { resolveModuleSpecifier } from "../resolution/resolveModule";
import { TSConfigInfo } from "../tsconfig/tsconfigLoader";

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
  const resolutionCache = new Map<string, string>();
  const fileLookupCache = new Map<string, string | null>();
  const projectFileSet = new Set(projectFiles.map(normalizeFilePath));

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
      const resolvedTargetFile = resolveModuleSpecifier(
        filePath,
        moduleSpecifier,
        projectFileSet,
        tsconfig,
        resolutionCache,
        fileLookupCache,
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
