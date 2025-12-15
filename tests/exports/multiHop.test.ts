import assert from "assert/strict";
import fs from "fs";
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
  assert.ok(resolved[file], `No resolved entries found for ${file}`);

  return resolved[file];
}

const FIXTURES = path.join(__dirname, "fixtures", "multiHop");

test("multi-hop named re-exports: source → mid → final", () => {
  const files = loadFiles(FIXTURES);
  const exportMap = scanExports(files);
  const resolved = resolveExportGraph(exportMap, files);

  const sourceFile = path.join(FIXTURES, "chainSource.ts");
  const midFile = path.join(FIXTURES, "chainMid.ts");
  const finalFile = path.join(FIXTURES, "chainFinal.ts");

  const finalExports = getResolved(resolved, finalFile);

  // The exported alias at the final hop
  const finalEntry = finalExports.find((e) => e.name === "finalFormatDate");
  assert.ok(finalEntry, "finalFormatDate should exist as an export");

  // Must resolve back to the original
  assert.equal(finalEntry!.originalName, "formatDate");
  assert.equal(finalEntry!.sourceFile, sourceFile);

  // Export chain should show FINAL → MID
  assert.deepEqual(finalEntry!.exportChain, [finalFile, midFile]);
});
