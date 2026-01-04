import { resolve } from "node:path";

// Memoize normalized paths, since this is called frequently
const normalizedFileCache = new Map<string, string>();

/**
 * Normalize a file path to a canonical absolute form.
 * - Resolves relative segments
 * - Converts backslashes → forward slashes
 * - Lowercases on Windows
 * - Fully memoized
 */
export function normalizeFilePath(path: string): string {
  const cached = normalizedFileCache.get(path);
  if (cached !== undefined) return cached;

  const absolutePath = resolve(path).replace(/\\/g, "/");
  const normalized = process.platform === "win32" ? absolutePath.toLowerCase() : absolutePath;

  normalizedFileCache.set(path, normalized);

  return normalized;
}
