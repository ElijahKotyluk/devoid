/**
 * Simple string interning.
 *
 * When we see the same string many times (identifiers, export names, etc.),
 * we keep a single shared copy. It saves memory and speeds up === checks.
 *
 * Nothing fancy here — only exact strings are stored as-is.
 */

const internTable = new Map<string, string>();

// Return the canonical instance for a given string.
export function intern(value: string): string {
  const existing = internTable.get(value);
  if (existing !== undefined) {
    return existing;
  }

  internTable.set(value, value);
  return value;
}

/**
 * Returns the number of interned strings.
 * Useful for debugging or profiling memory usage(very large projects).
 */
export function internCount(): number {
  return internTable.size;
}

/**
 * Clears all interned strings.
 * Meant to be used in testing or benchmarking.
 */
export function clearInternTable(): void {
  internTable.clear();
}
