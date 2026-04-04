import path from "node:path";
import { normalizeFilePath } from "../fileSystem/normalizePath";
import type { TSConfigInfo } from "../tsconfig/tsconfigLoader";

/**
 * Shared module resolution utilities.
 *
 * Centralizes file lookup and TSConfig alias resolution used by
 * the import graph builder, export graph resolver, and type usage graph.
 */

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const INDEX_FILES = EXTENSIONS.map((ext) => `index${ext}`);

/**
 * Try resolving a base path to a project file using extension and index patterns.
 * Uses a Set for O(1) lookups instead of Array.find().
 */
export function lookupProjectFile(
  unresolvedBasePath: string,
  projectFileSet: Set<string>,
  cache: Map<string, string | null>,
): string | null {
  const cached = cache.get(unresolvedBasePath);
  if (cached !== undefined) return cached;

  const resolved = path.resolve(unresolvedBasePath);
  const candidates = [
    resolved,
    ...EXTENSIONS.map((ext) => resolved + ext),
    ...INDEX_FILES.map((idx) => path.join(resolved, idx)),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeFilePath(candidate);
    if (projectFileSet.has(normalized)) {
      cache.set(unresolvedBasePath, normalized);
      return normalized;
    }
  }

  cache.set(unresolvedBasePath, null);
  return null;
}

/**
 * Resolve a TSConfig `paths` alias to a project file.
 */
export function resolveTSConfigAlias(
  moduleSpecifier: string,
  tsconfig: TSConfigInfo,
  projectFileSet: Set<string>,
  fileLookupCache: Map<string, string | null>,
): string | null {
  if (!tsconfig.paths) return null;

  for (const [aliasPattern, targetPatterns] of Object.entries(tsconfig.paths)) {
    const wildcardIndex = aliasPattern.indexOf("*");

    if (wildcardIndex !== -1) {
      const prefix = aliasPattern.slice(0, wildcardIndex);
      const suffix = aliasPattern.slice(wildcardIndex + 1);

      if (!moduleSpecifier.startsWith(prefix) || !moduleSpecifier.endsWith(suffix)) continue;

      const wildcardContent = moduleSpecifier.slice(
        prefix.length,
        moduleSpecifier.length - suffix.length,
      );

      for (const targetPattern of targetPatterns) {
        const substituted = targetPattern.replace("*", wildcardContent);
        const abs = path.resolve(tsconfig.baseUrl ?? "", substituted);
        const resolved = lookupProjectFile(abs, projectFileSet, fileLookupCache);
        if (resolved) return resolved;
      }
    } else if (moduleSpecifier === aliasPattern) {
      for (const target of targetPatterns) {
        const abs = path.resolve(tsconfig.baseUrl ?? "", target);
        const resolved = lookupProjectFile(abs, projectFileSet, fileLookupCache);
        if (resolved) return resolved;
      }
    }
  }

  return null;
}

/**
 * Resolve a module specifier (relative or aliased) to a project file path.
 * Returns the bare specifier for unresolvable (external) modules.
 */
export function resolveModuleSpecifier(
  importerFilePath: string,
  moduleSpecifier: string,
  projectFileSet: Set<string>,
  tsconfig: TSConfigInfo,
  resolutionCache: Map<string, string>,
  fileLookupCache: Map<string, string | null>,
): string {
  const cacheKey = `${importerFilePath}\x1F${moduleSpecifier}`;
  const cached = resolutionCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const importerDir = path.dirname(importerFilePath);

  // Relative imports
  if (moduleSpecifier.startsWith(".")) {
    const base = path.resolve(importerDir, moduleSpecifier);
    const resolved = lookupProjectFile(base, projectFileSet, fileLookupCache);

    if (resolved) {
      const normalized = normalizeFilePath(resolved);
      resolutionCache.set(cacheKey, normalized);
      return normalized;
    }
  }

  // TSConfig alias
  const aliasResolved = resolveTSConfigAlias(
    moduleSpecifier,
    tsconfig,
    projectFileSet,
    fileLookupCache,
  );
  if (aliasResolved) {
    const normalized = normalizeFilePath(aliasResolved);
    resolutionCache.set(cacheKey, normalized);
    return normalized;
  }

  // Bare specifier (external dep)
  resolutionCache.set(cacheKey, moduleSpecifier);
  return moduleSpecifier;
}

/**
 * Resolve a re-export target (relative specifier) to a project file.
 * Used by the export graph resolver.
 */
export function resolveReexportTarget(
  reexportingFile: string,
  moduleSpecifier: string,
  projectFileSet: Set<string>,
  fileLookupCache: Map<string, string | null>,
): string | null {
  const reexportingDir = path.dirname(reexportingFile);
  const base = path.resolve(reexportingDir, moduleSpecifier);
  return lookupProjectFile(base, projectFileSet, fileLookupCache);
}
