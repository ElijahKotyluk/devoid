import fs from "fs";
import path from "path";
import { normalizeFilePath } from "./normalizePath";

// Precompiled extension match
const EXT_REGEX = /\.(t|j)sx?$/;

// Caches reused during a single analysis run
const dirReadCache = new Map<string, fs.Dirent[]>();
const ignoreCache = new Map<string, boolean>();

/**
 * Recursively collect all .ts/.tsx/.js/.jsx files under `root`,
 * applying simple substring-based ignore rules.
 */
export function walkFiles(root: string, ignores: string[] = []): string[] {
  const results: string[] = [];

  function shouldIgnore(full: string): boolean {
    if (ignoreCache.has(full)) return ignoreCache.get(full)!;
    const ignored = ignores.some((pattern) => full.includes(pattern));
    ignoreCache.set(full, ignored);
    return ignored;
  }

  function readDir(dir: string): fs.Dirent[] {
    if (dirReadCache.has(dir)) return dirReadCache.get(dir)!;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    dirReadCache.set(dir, entries);
    return entries;
  }

  function walk(dir: string) {
    for (const entry of readDir(dir)) {
      const full = path.join(dir, entry.name);

      if (shouldIgnore(full)) continue;

      if (entry.isDirectory()) {
        walk(full);
      } else if (EXT_REGEX.test(entry.name)) {
        results.push(normalizeFilePath(full));
      }
    }
  }

  walk(root);
  return results;
}
