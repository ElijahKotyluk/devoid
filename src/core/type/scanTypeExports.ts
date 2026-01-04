import ts from "typescript";
import { intern } from "../../utils";

export interface TypeExportInfo {
  localExported: Set<string>; // Locally declared & exported types
  namedReexports: { name: string; as: string; from: string }[]; // e.g. export type { X as Y } from "..."
  wildcardReexports: string[]; // e.g. export * from "./x"
}

function hasExportModifier(node: ts.Node): boolean {
  const modifiers = (node as any).modifiers as ts.NodeArray<ts.Modifier> | undefined;

  return !!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

export function scanTypeExports(filePath: string, sourceText: string): TypeExportInfo {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.ESNext, true);

  const info: TypeExportInfo = {
    localExported: new Set(),
    namedReexports: [],
    wildcardReexports: [],
  };

  sourceFile.forEachChild((node) => {
    // export interface Foo { ... }
    if (ts.isInterfaceDeclaration(node) && hasExportModifier(node)) {
      info.localExported.add(intern(node.name.text));

      return;
    }

    // export type Foo = ...
    if (ts.isTypeAliasDeclaration(node) && hasExportModifier(node)) {
      info.localExported.add(intern(node.name.text));

      return;
    }

    // export { ... } from "..."
    // export type { ... } from "..."
    // export * from "..."
    if (ts.isExportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier
        ? node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, "")
        : null;

      if (!moduleSpecifier) return;

      // export * from "./x"
      if (!node.exportClause) {
        info.wildcardReexports.push(moduleSpecifier);

        return;
      }

      // export { ... } from "./x"
      if (ts.isNamedExports(node.exportClause)) {
        for (const el of node.exportClause.elements) {
          // Only include type-only export specifiers, or "export type { ... }"
          const isTypeOnly = (node as any).isTypeOnly === true || (el as any).isTypeOnly === true;

          if (!isTypeOnly) continue;

          const originalName = el.propertyName
            ? el.propertyName.getText(sourceFile)
            : el.name.getText(sourceFile);
          const exportedAs = el.name.getText(sourceFile);

          info.namedReexports.push({
            name: intern(originalName),
            as: intern(exportedAs),
            from: moduleSpecifier,
          });
        }
      }
    }
  });

  return info;
}
