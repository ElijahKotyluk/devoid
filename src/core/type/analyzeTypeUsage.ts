import ts from "typescript";
import { intern } from "../../utils";

/**
 * Type-usage results for a single file.
 * Narrow, syntax-based, no type-checker required.
 */
export interface TypeUsageResult {
  declaredTypes: Set<string>;
  exportedTypes: Set<string>;
  referencedTypes: Set<string>;
  qualifiedTypeRefs: Map<string, Set<string>>;
}

function hasExportModifier(node: ts.Node): boolean {
  const modifiers = (node as any).modifiers as ts.NodeArray<ts.Modifier> | undefined;

  return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

/**
 * Collect type declarations and references in type positions.
 * This does NOT do cross-file resolution - per-file only.
 */
export function analyzeTypeUsage(filePath: string, sourceText: string): TypeUsageResult {
  const ast = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.ESNext, true);

  const declaredTypes = new Set<string>();
  const exportedTypes = new Set<string>();
  const referencedTypes = new Set<string>();
  const qualifiedTypeRefs = new Map<string, Set<string>>();

  function addDeclared(name: string, exported: boolean) {
    const type = intern(name);

    declaredTypes.add(type);

    if (exported) exportedTypes.add(type);
  }

  // Collecting declarations for types and interfaces
  function collectDeclarations(node: ts.Node): void {
    if (ts.isInterfaceDeclaration(node)) {
      addDeclared(node.name.text, hasExportModifier(node));
    } else if (ts.isTypeAliasDeclaration(node)) {
      addDeclared(node.name.text, hasExportModifier(node));
    }

    ts.forEachChild(node, collectDeclarations);
  }

  // Collect type references
  function collectTypeRefsFromTypeNode(typeNode: ts.TypeNode): void {
    if (ts.isTypeReferenceNode(typeNode)) {
      collectEntityName(typeNode.typeName);

      for (const arg of typeNode.typeArguments ?? []) collectTypeRefsFromTypeNode(arg);

      return;
    }

    ts.forEachChild(typeNode, (child) => {
      if (ts.isTypeNode(child)) collectTypeRefsFromTypeNode(child);
      else
        ts.forEachChild(child, (g) => {
          if (ts.isTypeNode(g)) collectTypeRefsFromTypeNode(g);
        });
    });
  }

  function collectEntityName(name: ts.EntityName) {
    if (ts.isIdentifier(name)) {
      referencedTypes.add(intern(name.text));

      return;
    }

    // QualifiedName: left.right (e.g. T.Foo)
    if (ts.isIdentifier(name.left)) {
      const ns = intern(name.left.text);
      const member = intern(name.right.text);

      let set = qualifiedTypeRefs.get(ns);

      if (!set) qualifiedTypeRefs.set(ns, (set = new Set()));

      set.add(member);
    } else {
      collectEntityName(name.left);

      referencedTypes.add(intern(name.right.text));
    }
  }

  function visitForTypePositions(node: ts.Node): void {
    // Variable declarations: let x: Foo
    if (ts.isVariableDeclaration(node) && node.type) {
      collectTypeRefsFromTypeNode(node.type);
    }

    // Function/method params and return types
    if (ts.isParameter(node) && node.type) {
      collectTypeRefsFromTypeNode(node.type);
    }
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node)) &&
      node.type
    ) {
      collectTypeRefsFromTypeNode(node.type);
    }

    // Type aliases: type X = Foo
    if (ts.isTypeAliasDeclaration(node)) {
      collectTypeRefsFromTypeNode(node.type);
    }

    // Property and method signatures in interfaces
    if (ts.isPropertySignature(node) && node.type) {
      collectTypeRefsFromTypeNode(node.type);
    }

    if (ts.isMethodSignature(node) && node.type) {
      collectTypeRefsFromTypeNode(node.type);
    }

    // Heritage clauses (extends && implements)
    if ((ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.heritageClauses) {
      for (const heritageClause of node.heritageClauses) {
        for (const t of heritageClause.types) {
          const expression = t.expression;

          if (ts.isIdentifier(expression)) referencedTypes.add(intern(expression.text));

          if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.name)) {
            referencedTypes.add(intern(expression.name.text));
          }

          for (const arg of t.typeArguments ?? []) collectTypeRefsFromTypeNode(arg);
        }
      }
    }

    // Import declarations
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;

      if (!clause) return;

      if (clause.isTypeOnly) {
        if (clause.name) referencedTypes.add(intern(clause.name.text));

        const namedBindings = clause.namedBindings;

        if (namedBindings && ts.isNamedImports(namedBindings)) {
          for (const el of namedBindings.elements) {
            referencedTypes.add(intern(el.name.text));
          }
        }
      } else {
        const namedBindings = clause.namedBindings;

        if (namedBindings && ts.isNamedImports(namedBindings)) {
          for (const element of namedBindings.elements) {
            if (element.isTypeOnly === true) {
              referencedTypes.add(intern(element.name.text));
            }
          }
        }
      }
    }

    ts.forEachChild(node, visitForTypePositions);
  }

  collectDeclarations(ast);
  visitForTypePositions(ast);

  return { declaredTypes, exportedTypes, referencedTypes, qualifiedTypeRefs };
}
