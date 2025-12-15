import assert from "assert";
import fs from "fs";
import test from "node:test";
import path from "path";

import { analyzeExportUsage } from "../../src/core/exports/exportUsage";
import { scanExports } from "../../src/core/exports/scanExports.js";
import { buildImportGraph } from "../../src/core/imports/buildImportGraph";
import { loadTSConfig } from "../../src/core/tsconfig/tsconfigLoader";

const fixturesRoot = path.join(__dirname, "fixtures", "simple");

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

test("export usage: detects used and unused named/default exports", () => {
  const root = fixturesRoot;
  const files = loadFiles(root);

  const tsConfig = loadTSConfig(root);
  const importGraph = buildImportGraph(files, tsConfig);
  const exportMap = scanExports(files);

  const { used, unused } = analyzeExportUsage(exportMap, importGraph);

  const mathFile = path.join(root, "math.ts");
  const loggerFile = path.join(root, "logger.ts");

  assert.deepStrictEqual([...used[mathFile]].sort(), ["add"]);
  assert.deepStrictEqual([...unused[mathFile]].sort(), ["subtract"]);

  assert.deepStrictEqual([...used[loggerFile]].sort(), ["debug", "default"]);
  assert(!unused[loggerFile].has("default"));
  assert(used[loggerFile].has("default"));

  assert(used[loggerFile].has("debug"));
});
