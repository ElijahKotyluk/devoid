import assert from "assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

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

/** Helper to get resolved exports */
function getResolved(
  resolved: Record<string, ResolvedExportEntry[]>,
  file: string,
): ResolvedExportEntry[] {
  assert.ok(resolved[file], `No resolved exports for ${file}`);
  return resolved[file];
}

const FIXTURES = path.join(__dirname, "fixtures", "unresolved");

test("resolveGraphExports: ignores unresolved re-export targets but preserves locals", () => {
  const files = loadFiles(FIXTURES);
  const exportMap = scanExports(files);

  // Should NOT throw
  assert.doesNotThrow(() => {
    resolveExportGraph(exportMap, files);
  }, "resolver should not crash when re-export target does not exist");

  const resolved = resolveExportGraph(exportMap, files);

  const unresolvedFile = path.join(FIXTURES, "target.ts");

  const entries = getResolved(resolved, unresolvedFile);
  const names = entries.map((e) => e.name).sort();

  // Only local export should appear
  assert.deepEqual(names, ["FEATURE_FLAG"]);

  const flag = entries.find((e) => e.name === "FEATURE_FLAG")!;
  assert.equal(flag.originalName, "FEATURE_FLAG");
  assert.equal(flag.sourceFile, unresolvedFile);
  assert.deepEqual(flag.exportChain, []);
});
