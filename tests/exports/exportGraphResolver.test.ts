import assert from "assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { ResolvedExportEntry } from "../../src/core/exports/resolveExportGraph.js";
import { resolveExportGraph } from "../../src/core/exports/resolveExportGraph.js";
import { scanExports } from "../../src/core/exports/scanExports.js";

function loadFiles(root: string): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (full.endsWith(".ts")) {
        files.push(full);
      }
    }
  }

  walk(root);
  return files;
}

const FIXTURE_ROOT = path.join(__dirname, "fixtures", "resolveGraphExports");

function getResolved(
  resolvedMap: Record<string, ResolvedExportEntry[]>,
  filePath: string,
): ResolvedExportEntry[] {
  const entries = resolvedMap[filePath];
  assert.ok(entries, `No resolved exports found for ${filePath}`);
  return entries;
}

test("resolveGraphExports: resolves local named and default exports", () => {
  const files = loadFiles(FIXTURE_ROOT);
  const exportMap = scanExports(files);
  const resolved = resolveExportGraph(exportMap, files);

  const localFile = path.join(FIXTURE_ROOT, "localExports.ts");
  const entries = getResolved(resolved, localFile);

  const names = entries.map((e) => e.name).sort();
  assert.deepEqual(names, ["LOG_LEVEL", "createLogger", "default"]);

  const defaultEntry = entries.find((e) => e.name === "default");
  assert.ok(defaultEntry, "default export should be present");
  assert.equal(defaultEntry!.isDefault, true);
  assert.equal(defaultEntry!.sourceFile, localFile);

  const logLevel = entries.find((e) => e.name === "LOG_LEVEL");
  assert.ok(logLevel);
  assert.equal(logLevel!.originalName, "LOG_LEVEL");
  assert.equal(logLevel!.sourceFile, localFile);
  assert.deepEqual(logLevel!.exportChain, []);
});

test("resolveGraphExports: resolves named re-exports with alias", () => {
  const files = loadFiles(FIXTURE_ROOT);
  const exportMap = scanExports(files);
  const resolved = resolveExportGraph(exportMap, files);

  const sourceFile = path.join(FIXTURE_ROOT, "chainSource.ts");
  const aliasFile = path.join(FIXTURE_ROOT, "namedChainExport.ts");

  const aliasEntries = getResolved(resolved, aliasFile);

  const convertDate = aliasEntries.find((e) => e.name === "convertDate");
  assert.ok(convertDate, "convertDate should be exported");

  assert.equal(convertDate!.originalName, "formatDate");
  assert.equal(convertDate!.sourceFile, sourceFile);
  assert.deepEqual(convertDate!.exportChain, [aliasFile]);
});

test("resolveGraphExports: resolves multi-hop named re-export chains", () => {
  const files = loadFiles(FIXTURE_ROOT);
  const exportMap = scanExports(files);
  const resolved = resolveExportGraph(exportMap, files);

  const sourceFile = path.join(FIXTURE_ROOT, "chainSource.ts");
  const midFile = path.join(FIXTURE_ROOT, "chainMid.ts");
  const finalFile = path.join(FIXTURE_ROOT, "chainFinal.ts");

  const finalEntries = getResolved(resolved, finalFile);

  const finalExport = finalEntries.find((e) => e.name === "finalFormatDate");
  assert.ok(finalExport, "finalFormatDate should be exported from chainFinal.ts");

  assert.equal(finalExport!.originalName, "formatDate");
  assert.equal(finalExport!.sourceFile, sourceFile);

  // Export chain should show how it flowed: final → mid
  assert.deepEqual(finalExport!.exportChain, [finalFile, midFile]);
});

test("resolveGraphExports: propagates named exports through wildcard re-exports", () => {
  const files = loadFiles(FIXTURE_ROOT);
  const exportMap = scanExports(files);
  const resolved = resolveExportGraph(exportMap, files);

  const sourceFile = path.join(FIXTURE_ROOT, "wildcardSource.ts");
  const barrelFile = path.join(FIXTURE_ROOT, "wildcardBarrel.ts");

  const barrelExports = getResolved(resolved, barrelFile);
  const barrelNames = barrelExports.map((e) => e.name).sort();

  // wildcardSource exports: API_URL, DEFAULT_TIMEOUT, request
  assert.deepEqual(barrelNames, ["API_URL", "DEFAULT_TIMEOUT", "request"]);

  for (const name of ["API_URL", "DEFAULT_TIMEOUT", "request"]) {
    const entry = barrelExports.find((e) => e.name === name);
    assert.ok(entry, `${name} should be present on wildcard barrel`);
    assert.equal(entry!.sourceFile, sourceFile);
    assert.deepEqual(entry!.exportChain, [barrelFile]);
  }

  // Ensure default was NOT pulled in via wildcard
  assert.ok(!barrelExports.some((e) => e.name === "default"));
});

test("resolveGraphExports: handles cyclic re-exports safely", () => {
  const files = loadFiles(FIXTURE_ROOT);
  const exportMap = scanExports(files);

  // Should NOT throw or hang
  assert.doesNotThrow(() => {
    resolveExportGraph(exportMap, files);
  }, "resolver should not crash or hang on cyclic re-exports");

  const resolved = resolveExportGraph(exportMap, files);

  const cycleOneFile = path.join(FIXTURE_ROOT, "cycleOne.ts");
  const cycleTwoFile = path.join(FIXTURE_ROOT, "cycleTwo.ts");

  const oneExports = getResolved(resolved, cycleOneFile);
  const twoExports = getResolved(resolved, cycleTwoFile);

  // Each should at least contain its own local export
  const hasOneLocal = oneExports.some((e) => e.name === "FIRST_FEATURE");
  const hasTwoLocal = twoExports.some((e) => e.name === "SECOND_FEATURE");

  assert.ok(hasOneLocal, "cycleOne.ts should keep its local export");
  assert.ok(hasTwoLocal, "cycleTwo.ts should keep its local export");

  // Cycle should NOT cause duplicates or infinite chain growth
  const maxAllowedChainLength = 3;
  for (const entry of [...oneExports, ...twoExports]) {
    assert.ok(
      entry.exportChain.length <= maxAllowedChainLength,
      `exportChain should not grow infinitely (got: ${entry.exportChain.join(" -> ")})`,
    );
  }
});

test("resolveGraphExports: ignores unresolved re-export targets but keeps locals", () => {
  const files = loadFiles(FIXTURE_ROOT);
  const exportMap = scanExports(files);
  const resolved = resolveExportGraph(exportMap, files);

  const unresolvedFile = path.join(FIXTURE_ROOT, "unresolvedTarget.ts");
  const entries = getResolved(resolved, unresolvedFile);

  const names = entries.map((e) => e.name).sort();
  assert.deepEqual(names, ["FEATURE_FLAG"]);

  const flag = entries.find((e) => e.name === "FEATURE_FLAG");
  assert.ok(flag);
  assert.equal(flag!.sourceFile, unresolvedFile);
  assert.deepEqual(flag!.exportChain, []);
});
