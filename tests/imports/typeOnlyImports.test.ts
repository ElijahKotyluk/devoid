import assert from "assert";
import fs from "fs";
import test from "node:test";
import path from "path";

import { analyzeExportUsage } from "../../src/core/exports/exportUsage.js";
import { scanExports } from "../../src/core/exports/scanExports.js";
import { buildImportGraph } from "../../src/core/imports/buildImportGraph.js";
import { loadTSConfig } from "../../src/core/tsconfig/tsconfigLoader.js";

function loadFiles(root: string) {
  const out: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);

      if (stat.isDirectory()) walk(full);
      else if (full.endsWith(".ts")) out.push(full);
    }
  }

  walk(root);

  return out;
}

test("type-only imports produce no import graph edges", () => {
  const root = path.join(__dirname, "fixtures", "typeOnly");
  const files = loadFiles(root);

  const tsConfig = loadTSConfig(root);
  const graph = buildImportGraph(files, tsConfig);

  const consumerFile = path.join(root, "consumer.ts");
  const imports = graph[consumerFile];

  // Even though there is `import type { User }`, it should NOT appear.
  assert.strictEqual(imports.length, 0);
});

test("type-only imports do not mark exports as used", () => {
  const root = path.join(__dirname, "fixtures", "typeOnly");
  const files = loadFiles(root);

  const tsConfig = loadTSConfig(root);
  const importGraph = buildImportGraph(files, tsConfig);
  const exportMap = scanExports(files);

  const { unused } = analyzeExportUsage(exportMap, importGraph);

  const modelFile = path.join(root, "models", "user.ts");
  const unusedExports = [...unused[modelFile]];

  // The type is NOT referenced at runtime → should be counted as unused.
  assert.deepStrictEqual(unusedExports.sort(), ["User"]);
});
