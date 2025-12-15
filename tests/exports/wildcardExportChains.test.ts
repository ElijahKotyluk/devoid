import assert from "assert";
import fs from "fs";
import test from "node:test";
import path from "path";

import { analyzeExportUsage } from "../../src/core/exports/exportUsage";
import { scanExports } from "../../src/core/exports/scanExports.js";
import { buildImportGraph } from "../../src/core/imports/buildImportGraph";
import { loadTSConfig } from "../../src/core/tsconfig/tsconfigLoader";

const fixturesRoot = path.join(__dirname, "fixtures", "wildcard");

function loadFiles(root: string): string[] {
  const out: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) walk(full);
      else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
    }
  }

  walk(root);

  return out;
}

test("wildcard re-exports: usage propagates from consumer through index to source", () => {
  const root = fixturesRoot;
  const files = loadFiles(root);

  const tsConfig = loadTSConfig(root);
  const importGraph = buildImportGraph(files, tsConfig);
  const exportMap = scanExports(files);

  const { used, unused } = analyzeExportUsage(exportMap, importGraph);

  const controllerFile = path.join(root, "controller.ts");
  const indexFile = path.join(root, "index.ts");

  assert(used[controllerFile].has("getUser"));
  assert(used[controllerFile].has("createUser"));

  assert(unused[controllerFile].size === 0);

  assert(used[indexFile].size > 0);
});
