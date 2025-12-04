import fs from "fs";
import assert from "node:assert/strict";
import test from "node:test";
import path from "path";

import {
  resolveExportGraph,
  type ResolvedExportEntry,
} from "../../src/core/exports/resolveExportGraph.js";
import { scanExports } from "../../src/core/exports/scanExports.js";

function loadFiles(root: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (full.endsWith(".ts")) results.push(full);
    }
  }

  walk(root);
  return results;
}

function getResolved(
  resolved: Record<string, ResolvedExportEntry[]>,
  file: string,
): ResolvedExportEntry[] {
  assert.ok(resolved[file], `No resolved exports for ${file}`);
  return resolved[file];
}

const FIXTURES = path.join(__dirname, "fixtures", "wildcardReexports");

test("wildcard re-exports propagate named exports but exclude default", () => {
  const files = loadFiles(FIXTURES);
  const exportMap = scanExports(files);
  const resolved = resolveExportGraph(exportMap, files);

  const sourceFile = path.join(FIXTURES, "wildcardSource.ts");
  const barrelFile = path.join(FIXTURES, "wildcardBarrel.ts");

  const barrelExports = getResolved(resolved, barrelFile);

  // Expected named exports from source
  const expectedNames = ["API_URL", "DEFAULT_TIMEOUT", "request"].sort();

  const actualNames = barrelExports.map((e) => e.name).sort();

  assert.deepEqual(
    actualNames,
    expectedNames,
    "Wildcard should re-export all named but exclude default",
  );

  // Validate export chain + source for each entry
  for (const name of expectedNames) {
    const entry = barrelExports.find((e) => e.name === name);
    assert.ok(entry, `${name} must be present on wildcard barrel`);

    assert.equal(entry!.sourceFile, sourceFile);
    assert.deepEqual(entry!.exportChain, [barrelFile]);
  }

  // Ensure default export is excluded
  assert.ok(
    !barrelExports.some((e) => e.name === "default"),
    "Wildcard must NOT re-export default",
  );
});
