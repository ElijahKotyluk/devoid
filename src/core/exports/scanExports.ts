import ts from "typescript";
import { intern } from "../../utils/intern";
import { normalizeFilePath } from "../fileSystem/normalizePath";

// Cache file reads across a run
const exportSourceTextCache = new Map<string, string | null>();

function getSourceText(filePath: string): string | undefined {
  if (exportSourceTextCache.has(filePath)) {
    const cached = exportSourceTextCache.get(filePath);
    return cached === null ? undefined : cached;
  }

  const sourceText = ts.sys.readFile(filePath);
  exportSourceTextCache.set(filePath, sourceText ?? null);
  return sourceText ?? undefined;
}

export interface ExportInfo {
  default?: boolean;
  named: string[];
  wildcardReexports: string[];
  namedReexports: {
    name: string; // original symbol name
    as: string; // exported name in this file
    from: string; // raw module specifier
  }[];
}

/**
 * Parse export syntax in all project files.
 * Produces a normalized map of each file’s declared and re-exported symbols.
 * Paths remain unresolved—resolution happens later.
 */
export function scanExports(files: string[]): Record<string, ExportInfo> {
  const exportMap: Record<string, ExportInfo> = {};

  for (const filePath of files) {
    const sourceText = getSourceText(filePath);

    if (!sourceText) {
      exportMap[filePath] = {
        default: false,
        named: [],
        wildcardReexports: [],
        namedReexports: [],
      };
      continue;
    }

    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.ES2022, true);

    exportMap[normalizeFilePath(filePath)] = scanFileExports(filePath, sourceFile);
  }

  return exportMap;
}

/**
 * Extracts export declarations from a single file.
 * This function only inspects syntax; it does not resolve module specifiers.
 */
export function scanFileExports(filePath: string, sourceFile: ts.SourceFile): ExportInfo {
  const exportInfo: ExportInfo = {
    default: false,
    named: [],
    wildcardReexports: [],
    namedReexports: [],
  };

  sourceFile.forEachChild((node) => {
    // export default ...
    if (ts.isExportAssignment(node)) {
      exportInfo.default = true;
      return;
    }

    // export <decl>
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isVariableStatement(node)
    ) {
      if (!node.modifiers) return;

      const isExported = node.modifiers.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      );
      if (!isExported) return;

      const isDefaultExport = node.modifiers.some(
        (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
      );
      if (isDefaultExport) {
        exportInfo.default = true;
        return;
      }

      // Named exports via declarations
      if ("name" in node && node.name) {
        exportInfo.named.push(intern(node.name.text));
      } else if (ts.isVariableStatement(node)) {
        for (const declarationNode of node.declarationList.declarations) {
          if (ts.isIdentifier(declarationNode.name)) {
            exportInfo.named.push(intern(declarationNode.name.text));
          }
        }
      }

      return;
    }

    // export {...} or export * from
    if (ts.isExportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier
        ? node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, "")
        : null;

      // export { foo, bar as baz }
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          const originalName = element.propertyName
            ? element.propertyName.getText(sourceFile)
            : element.name.getText(sourceFile);

          const exportedAs = element.name.getText(sourceFile);

          if (moduleSpecifier) {
            exportInfo.namedReexports.push({
              name: intern(originalName),
              as: intern(exportedAs),
              from: moduleSpecifier,
            });
          } else {
            exportInfo.named.push(intern(exportedAs));
          }
        }
        return;
      }

      // export * from "./x"
      if (!node.exportClause && moduleSpecifier) {
        exportInfo.wildcardReexports.push(moduleSpecifier);
        return;
      }
    }
  });

  return exportInfo;
}
