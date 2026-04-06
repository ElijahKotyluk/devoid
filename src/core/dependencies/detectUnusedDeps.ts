import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export interface UnusedDepsResult {
  unused: string[];
  used: string[];
  total: number;
}

/**
 * Detect unused dependencies by comparing package.json deps
 * against actual imports in the project source files.
 *
 * Only checks `dependencies` (not devDependencies) by default.
 * Returns which declared dependencies are never imported.
 */
export function detectUnusedDeps(
  projectRoot: string,
  sourceFiles: string[],
  options: { includeDevDeps?: boolean } = {},
): UnusedDepsResult {
  const pkgPath = path.join(projectRoot, "package.json");

  if (!fs.existsSync(pkgPath)) {
    return { unused: [], used: [], total: 0 };
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  } catch {
    return { unused: [], used: [], total: 0 };
  }

  // Collect declared dependencies
  const declaredDeps = new Set<string>();

  const deps = pkg.dependencies as Record<string, string> | undefined;
  if (deps && typeof deps === "object") {
    for (const name of Object.keys(deps)) {
      declaredDeps.add(name);
    }
  }

  if (options.includeDevDeps) {
    const devDeps = pkg.devDependencies as Record<string, string> | undefined;
    if (devDeps && typeof devDeps === "object") {
      for (const name of Object.keys(devDeps)) {
        declaredDeps.add(name);
      }
    }
  }

  if (declaredDeps.size === 0) {
    return { unused: [], used: [], total: 0 };
  }

  // Scan all source files for bare import specifiers
  const importedPackages = new Set<string>();

  for (const filePath of sourceFiles) {
    const fileContents = ts.sys.readFile(filePath);
    if (!fileContents) continue;

    const sourceFile = ts.createSourceFile(filePath, fileContents, ts.ScriptTarget.ESNext, true);

    sourceFile.forEachChild((node) => {
      // import declarations
      if (ts.isImportDeclaration(node)) {
        const specifier = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, "");
        const pkgName = extractPackageName(specifier);
        if (pkgName) importedPackages.add(pkgName);
      }

      // require() calls
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require" &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const pkgName = extractPackageName(node.arguments[0].text);
        if (pkgName) importedPackages.add(pkgName);
      }

      // export ... from "pkg"
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        const specifier = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, "");
        const pkgName = extractPackageName(specifier);
        if (pkgName) importedPackages.add(pkgName);
      }
    });
  }

  // Compare declared vs imported
  const used: string[] = [];
  const unused: string[] = [];

  for (const dep of [...declaredDeps].sort()) {
    if (importedPackages.has(dep)) {
      used.push(dep);
    } else {
      unused.push(dep);
    }
  }

  return { unused, used, total: declaredDeps.size };
}

/**
 * Extract the package name from a module specifier.
 * Returns null for relative imports.
 *
 * "lodash" → "lodash"
 * "lodash/fp" → "lodash"
 * "@scope/pkg" → "@scope/pkg"
 * "@scope/pkg/sub" → "@scope/pkg"
 * "./local" → null
 */
function extractPackageName(specifier: string): string | null {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;

  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    return null;
  }

  return specifier.split("/")[0];
}
