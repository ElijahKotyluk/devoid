import ts from "typescript";
import { intern } from "../../utils";

/**
 * Controls how aggressively local variable declarations are tracked.
 * Default mode ignores typed variable declarations to reduce noise.
 */
export interface LocalUsageOptions {
  trackAllLocals?: boolean;
}

/**
 * Intra-file usage results:
 *   • declared: identifiers introduced in this file
 *   • referenced: declared identifiers used in non-declaration positions
 *   • unused: declared identifiers never referenced
 */
export interface LocalUsageResult {
  declared: string[];
  referenced: string[];
  unused: string[];
}

/**
 * Lightweight, per-file identifier usage analysis.
 * Detects unused local functions, classes, variables, enums, types, etc.
 *
 * Does not attempt:
 *   • cross-file analysis
 *   • scope shadowing
 *   • property access resolution (obj.foo not counted as referencing foo)
 *   • unreachable code detection
 */
export function analyzeLocalUsage(
  filePath: string,
  sourceText: string,
  options: LocalUsageOptions = {},
): LocalUsageResult {
  const ast = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.ESNext, true);

  const declaredIdentifiers = new Set<string>();
  const referencedIdentifiers = new Set<string>();
  const trackAllLocals = options.trackAllLocals === true;

  // Collect top-level declared identifiers (functions, classes, vars, types, etc.)
  function collectDeclarations(node: ts.Node): void {
    // Named declarations
    if (ts.isFunctionDeclaration(node) && node.name) {
      declaredIdentifiers.add(intern(node.name.text));
    }
    if (ts.isClassDeclaration(node) && node.name) {
      declaredIdentifiers.add(intern(node.name.text));
    }
    if (ts.isInterfaceDeclaration(node)) {
      declaredIdentifiers.add(intern(node.name.text));
    }
    if (ts.isTypeAliasDeclaration(node)) {
      declaredIdentifiers.add(intern(node.name.text));
    }
    if (ts.isEnumDeclaration(node)) {
      declaredIdentifiers.add(intern(node.name.text));
    }

    // Variable declarations
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const identifierName = intern(node.name.text);
      if (trackAllLocals || !node.type) {
        declaredIdentifiers.add(identifierName);
      }
    }

    ts.forEachChild(node, collectDeclarations);
  }

  collectDeclarations(ast);

  // Identifiers that belong to declarations should not be treated as references.
  function isIdentifierPartOfDeclaration(node: ts.Identifier): boolean {
    const parent = node.parent;
    return (
      ts.isFunctionDeclaration(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isInterfaceDeclaration(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isEnumDeclaration(parent) ||
      ts.isVariableDeclaration(parent)
    );
  }

  /**
   * Collect references by walking all identifiers and checking:
   *   • they match a declared identifier
   *   • they are not in a declaration position
   */
  function collectReferences(node: ts.Node): void {
    if (ts.isIdentifier(node)) {
      const identifierName = intern(node.text);

      if (declaredIdentifiers.has(identifierName) && !isIdentifierPartOfDeclaration(node)) {
        referencedIdentifiers.add(identifierName);
      }
    }

    ts.forEachChild(node, collectReferences);
  }

  collectReferences(ast);

  const unusedIdentifiers = [...declaredIdentifiers].filter(
    (declaredName) => !referencedIdentifiers.has(declaredName),
  );

  return {
    declared: [...declaredIdentifiers],
    referenced: [...referencedIdentifiers],
    unused: unusedIdentifiers,
  };
}
