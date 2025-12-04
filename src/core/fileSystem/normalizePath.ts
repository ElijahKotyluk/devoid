import { resolve } from "path";

// Memoize normalized paths, since this is called frequently
const normalizeCache = new Map<string, string>();

/**
 * Normalize a file path to a canonical absolute form.
 * - Resolves relative segments
 * - Converts backslashes → forward slashes
 * - Lowercases on Windows
 * - Fully memoized
 */
export function normalizeFilePath(path: string): string {
  const cached = normalizeCache.get(path);
  if (cached !== undefined) return cached;

  const abs = resolve(path).replace(/\\/g, "/");
  const normalized = process.platform === "win32" ? abs.toLowerCase() : abs;

  normalizeCache.set(path, normalized);
  return normalized;
}
