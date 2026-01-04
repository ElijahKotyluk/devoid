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
      if (entry.isDirectory()) walk(full);
      else if (full.endsWith(".ts")) files.push(full);
    }
  }

  walk(root);
  return files;
}

const FIX = path.join(__dirname, "fixtures", "conflictingExports");

function resolvedFor(map: Record<string, ResolvedExportEntry[]>, file: string) {
  const entries = map[file];
  assert.ok(entries, `Missing resolved exports for ${file}`);
  return entries;
}

test("conflicting exports: later wildcard re-export overwrites earlier", () => {
  const files = loadFiles(FIX);
  const exportMap = scanExports(files);
  const resolved = resolveExportGraph(exportMap, files);

  const barrel = path.join(FIX, "aggregatedConfig.ts");
  const userSettings = path.join(FIX, "userSettings.ts");
  const featureFlags = path.join(FIX, "featureFlags.ts");

  const entries = resolvedFor(resolved, barrel);
  const names = entries.map((e) => e.name).sort();

  assert.deepEqual(names, ["APP_THEME"]);

  const entry = entries.find((e) => e.name === "APP_THEME")!;
  assert.equal(entry.sourceFile, featureFlags, "later wildcard should win");
});

test("conflicting exports: explicit re-export overrides wildcard", () => {
  const files = loadFiles(FIX);
  const exportMap = scanExports(files);
  const resolved = resolveExportGraph(exportMap, files);

  const overrideConfig = path.join(FIX, "overrideConfig.ts");
  const userSettings = path.join(FIX, "userSettings.ts");
  const featureFlags = path.join(FIX, "featureFlags.ts");

  const entries = resolvedFor(resolved, overrideConfig);
  const entry = entries.find((e) => e.name === "APP_THEME")!;

  // explicit > wildcard
  assert.equal(entry.sourceFile, userSettings);
});

test("conflicting exports: default re-exported under alias resolves correctly", () => {
  const files = loadFiles(FIX);
  const exportMap = scanExports(files);
  const resolved = resolveExportGraph(exportMap, files);

  const facade = path.join(FIX, "loggingFacade.ts");
  const loggerFile = path.join(FIX, "logger.ts");

  const entries = resolvedFor(resolved, facade);

  const names = entries.map((e) => e.name).sort();
  assert.deepEqual(names, ["Logger"]);

  const entry = entries.find((e) => e.name === "Logger")!;
  assert.equal(entry.originalName, "default");
  assert.equal(entry.sourceFile, loggerFile);
});
