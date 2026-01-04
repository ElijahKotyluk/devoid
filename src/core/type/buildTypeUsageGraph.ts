import path from "node:path";
import ts from "typescript";

import { intern } from "../../utils";
import { normalizeFilePath } from "../fileSystem/normalizePath";
import type { TSConfigInfo } from "../tsconfig/tsconfigLoader";

import { analyzeTypeUsage } from "./analyzeTypeUsage";
import { resolveTypeExportGraph, type ResolvedTypeExportEntry } from "./resolveTypeExportGraph";
import { scanTypeExports } from "./scanTypeExports";

export interface TypeUsageGraph {
  unusedExportedTypes: { file: string; name: string }[];
  unusedLocalTypes: { file: string; name: string }[];
}

// Cache file reads across a run
const sourceTextCache = new Map<string, string | null>();

function getSourceText(filePath: string): string | undefined {
  if (sourceTextCache.has(filePath)) {
    const cached = sourceTextCache.get(filePath);
    return cached === null ? undefined : cached;
  }

  const text = ts.sys.readFile(filePath);
  sourceTextCache.set(filePath, text ?? null);
  return text ?? undefined;
}

function createResolutionKey(importerFilePath: string, moduleSpecifier: string): string {
  return `${importerFilePath}\x1F${moduleSpecifier}`;
}

function lookupProjectFile(
  unresolvedBasePath: string,
  projectFiles: string[],
  fileLookupCache: Map<string, string | null>,
): string | null {
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
    const match = projectFiles.find((p) => path.resolve(p) === path.resolve(candidatePath));

    if (match) {
      fileLookupCache.set(unresolvedBasePath, match);

      return match;
    }
  }

  fileLookupCache.set(unresolvedBasePath, null);

  return null;
}

function resolveTSConfigAlias(
  moduleSpecifier: string,
  tsconfig: TSConfigInfo,
  projectFiles: string[],
  fileLookupCache: Map<string, string | null>,
): string | null {
  if (!tsconfig.paths) return null;

  for (const [aliasPattern, targetPatterns] of Object.entries(tsconfig.paths)) {
    const wildcardIndex = aliasPattern.indexOf("*");

    // Wildcard alias
    if (wildcardIndex !== -1) {
      const prefix = aliasPattern.slice(0, wildcardIndex);
      const suffix = aliasPattern.slice(wildcardIndex + 1);

      if (!moduleSpecifier.startsWith(prefix) || !moduleSpecifier.endsWith(suffix)) continue;

      const wildcard = moduleSpecifier.slice(prefix.length, moduleSpecifier.length - suffix.length);

      for (const targetPattern of targetPatterns) {
        const substituted = targetPattern.replace("*", wildcard);
        const abs = path.resolve(tsconfig.baseUrl ?? "", substituted);

        const resolved = lookupProjectFile(abs, projectFiles, fileLookupCache);

        if (resolved) return resolved;
      }
    }

    // Exact alias
    else if (moduleSpecifier === aliasPattern) {
      for (const target of targetPatterns) {
        const abs = path.resolve(tsconfig.baseUrl ?? "", target);
        const resolved = lookupProjectFile(abs, projectFiles, fileLookupCache);

        if (resolved) return resolved;
      }
    }
  }

  return null;
}

function resolveModuleSpecifierToProjectFile(
  importerFilePath: string,
  moduleSpecifier: string,
  projectFiles: string[],
  tsconfig: TSConfigInfo,
  resolutionCache: Map<string, string>,
  fileLookupCache: Map<string, string | null>,
): string {
  const key = createResolutionKey(importerFilePath, moduleSpecifier);
  const cached = resolutionCache.get(key);

  if (cached !== undefined) return cached;

  const importerDir = path.dirname(importerFilePath);

  // Relative
  if (moduleSpecifier.startsWith(".")) {
    const base = path.resolve(importerDir, moduleSpecifier);
    const resolved = lookupProjectFile(base, projectFiles, fileLookupCache);

    if (resolved) {
      const n = normalizeFilePath(resolved);

      resolutionCache.set(key, n);

      return n;
    }
  }

  // TSConfig alias
  const aliasResolved = resolveTSConfigAlias(
    moduleSpecifier,
    tsconfig,
    projectFiles,
    fileLookupCache,
  );
  if (aliasResolved) {
    const n = normalizeFilePath(aliasResolved);

    resolutionCache.set(key, n);

    return n;
  }

  resolutionCache.set(key, moduleSpecifier);

  return moduleSpecifier;
}

function extractTypeImports(
  importNode: ts.ImportDeclaration,
  fileAST: ts.SourceFile,
): { named: string[]; namespace: string | null } {
  const clause = importNode.importClause;

  if (!clause) return { named: [], namespace: null };

  const named = new Set<string>();
  let namespace: string | null = null;

  // `import type Foo from "./x"` (rare, but valid)
  if (clause.isTypeOnly && clause.name) {
    named.add(intern(clause.name.getText(fileAST)));
  }

  const bindings = clause.namedBindings;

  if (!bindings) return { named: [...named], namespace };

  // `import type * as T from "./x"`
  if (ts.isNamespaceImport(bindings)) {
    if (clause.isTypeOnly) namespace = intern(bindings.name.text);

    return { named: [...named], namespace };
  }

  // `import type { Foo }` and `import { type Foo }`
  if (ts.isNamedImports(bindings)) {
    for (const el of bindings.elements) {
      const isTypeOnly = clause.isTypeOnly || (el as any).isTypeOnly === true;

      if (!isTypeOnly) continue;

      named.add(intern(el.name.getText(fileAST)));
    }
  }

  return { named: [...named], namespace };
}

function buildResolvedExportLookup(
  resolved: Record<string, ResolvedTypeExportEntry[]>,
): Map<string, Map<string, ResolvedTypeExportEntry>> {
  const out = new Map<string, Map<string, ResolvedTypeExportEntry>>();

  for (const [file, entries] of Object.entries(resolved)) {
    const table = new Map<string, ResolvedTypeExportEntry>();

    for (const e of entries) table.set(e.name, e);

    out.set(file, table);
  }

  return out;
}

/**
 * Build type-usage results across a project (syntax-based).
 * Marks an exported type as "used" if it is imported as a type from another file,
 * including via barrel re-exports and namespace imports.
 */
export function buildTypeUsageGraph(filePaths: string[], tsconfig: TSConfigInfo): TypeUsageGraph {
  const byFile = new Map<string, ReturnType<typeof analyzeTypeUsage>>();

  for (const file of filePaths) {
    const text = getSourceText(file);

    if (!text) continue;

    byFile.set(file, analyzeTypeUsage(file, text));
  }

  // Scan type export surfaces and resolve barrel re-exports
  const typeExportMap: Record<string, ReturnType<typeof scanTypeExports>> = {};

  for (const file of filePaths) {
    const text = getSourceText(file);

    if (!text) {
      typeExportMap[file] = { localExported: new Set(), namedReexports: [], wildcardReexports: [] };

      continue;
    }

    typeExportMap[file] = scanTypeExports(file, text);
  }

  const resolvedExports = resolveTypeExportGraph(typeExportMap, filePaths);
  const resolvedLookup = buildResolvedExportLookup(resolvedExports);

  // Track which origin exported types are used by type-only imports
  const usedExportedTypesByOriginFile = new Map<string, Set<string>>();

  function markUsed(originFile: string, originName: string) {
    let set = usedExportedTypesByOriginFile.get(originFile);

    if (!set) {
      set = new Set();

      usedExportedTypesByOriginFile.set(originFile, set);
    }

    set.add(intern(originName));
  }

  const resolutionCache = new Map<string, string>();
  const fileLookupCache = new Map<string, string | null>();

  // Scan type-only imports (named + namespace) and mark corresponding origin types as used
  for (const importerFile of filePaths) {
    const text = getSourceText(importerFile);

    if (!text) continue;

    const ast = ts.createSourceFile(importerFile, text, ts.ScriptTarget.ESNext, true);

    // namespace import name -> resolved target file
    const namespaceTargets = new Map<string, string>();

    ast.forEachChild((node) => {
      if (!ts.isImportDeclaration(node)) return;

      const moduleSpecifier = node.moduleSpecifier.getText(ast).replace(/['"]/g, "");
      const { named: importedTypeNames, namespace } = extractTypeImports(node, ast);

      if (importedTypeNames.length === 0 && !namespace) return;

      const resolvedTarget = resolveModuleSpecifierToProjectFile(
        importerFile,
        moduleSpecifier,
        filePaths,
        tsconfig,
        resolutionCache,
        fileLookupCache,
      );

      // Record namespace target if it resolves to a project file
      if (namespace && resolvedLookup.has(resolvedTarget)) {
        namespaceTargets.set(namespace, resolvedTarget);
      }

      // Named type imports
      if (importedTypeNames.length > 0) {
        const table = resolvedLookup.get(resolvedTarget);

        if (!table) return;

        for (const name of importedTypeNames) {
          const entry = table.get(name);

          if (entry) markUsed(entry.sourceFile, entry.originalName);
        }
      }
    });

    // Namespace member refs: T.Foo -> resolve Foo through export surface of module imported as T
    const usage = byFile.get(importerFile);

    if (!usage) continue;

    for (const [ns, members] of usage.qualifiedTypeRefs.entries()) {
      const targetFile = namespaceTargets.get(ns);

      if (!targetFile) continue;

      const table = resolvedLookup.get(targetFile);

      if (!table) continue;

      for (const member of members) {
        const entry = table.get(member);

        if (entry) markUsed(entry.sourceFile, entry.originalName);
      }
    }
  }

  // Compute unused exported types (origin declarations only)
  const unusedExportedTypes: { file: string; name: string }[] = [];

  for (const file of filePaths) {
    const exported = typeExportMap[file]?.localExported;

    if (!exported || exported.size === 0) continue;

    const used = usedExportedTypesByOriginFile.get(file) ?? new Set<string>();

    for (const t of exported) {
      if (!used.has(t)) unusedExportedTypes.push({ file, name: t });
    }
  }

  // Compute unused local types (per file)
  const unusedLocalTypes: { file: string; name: string }[] = [];

  for (const [file, res] of byFile.entries()) {
    for (const t of res.declaredTypes) {
      if (!res.referencedTypes.has(t)) {
        unusedLocalTypes.push({ file, name: t });
      }
    }
  }

  return { unusedExportedTypes, unusedLocalTypes };
}
