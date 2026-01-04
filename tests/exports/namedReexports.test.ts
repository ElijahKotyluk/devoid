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
  const out: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) walk(full);
      else if (full.endsWith(".ts")) out.push(full);
    }
  }

  walk(root);

  return out;
}

function getResolved(
  resolved: Record<string, ResolvedExportEntry[]>,
  file: string,
): ResolvedExportEntry[] {
  assert.ok(resolved[file], `No resolved entries for ${file}`);
  return resolved[file];
}

const FIXTURES = path.join(__dirname, "fixtures", "namedReexports");

test("named re-exports: alias resolves to the original source", () => {
  const files = loadFiles(FIXTURES);
  const exportMap = scanExports(files);
  const resolved = resolveExportGraph(exportMap, files);

  const sourceFile = path.join(FIXTURES, "chainSource.ts");
  const aliasFile = path.join(FIXTURES, "namedChainExport.ts");

  const aliasExports = getResolved(resolved, aliasFile);

  // Find the aliased export
  const convertDate = aliasExports.find((e) => e.name === "convertDate");
  assert.ok(convertDate, "convertDate should appear in namedChainExport.ts");

  // It should resolve back to the original function
  assert.equal(convertDate!.originalName, "formatDate");
  assert.equal(convertDate!.sourceFile, sourceFile);

  // Export chain should show the re-export hop
  assert.deepEqual(convertDate!.exportChain, [aliasFile]);
});
