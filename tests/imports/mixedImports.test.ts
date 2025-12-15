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

test("mixed imports: runtime imports create edges, type imports do not", () => {
  const root = path.join(__dirname, "fixtures", "mixedImports");
  const files = loadFiles(root);

  const tsConfig = loadTSConfig(root);
  const graph = buildImportGraph(files, tsConfig);

  const consumerFile = path.join(root, "consumer.ts");
  const imports = graph[consumerFile] ?? [];

  const targets = new Set(imports.map((i) => i.sourceFile));

  const utilsDateFile = path.join(root, "utils", "date.ts");
  const modelsUserFile = path.join(root, "models", "user.ts");

  // runtime import: { formatDate }
  assert(targets.has(utilsDateFile), "runtime import should create a graph edge");

  const importedSymbols = imports.flatMap((i) => i.imported);
  assert.deepStrictEqual(
    importedSymbols.sort(),
    ["formatDate"],
    "type-only symbols must be omitted from the import graph",
  );

  // type-only import from models/user.ts → NO edge
  assert(!targets.has(modelsUserFile), "type-only import must NOT create a graph edge");
});

test("mixed imports: runtime usage marks exports as used, type-only does not", () => {
  const root = path.join(__dirname, "fixtures", "mixedImports");
  const files = loadFiles(root);

  const tsConfig = loadTSConfig(root);
  const importGraph = buildImportGraph(files, tsConfig);
  const exportMap = scanExports(files);

  const { unused } = analyzeExportUsage(exportMap, importGraph);

  const utilsDateFile = path.join(root, "utils", "date.ts");
  const modelsUserFile = path.join(root, "models", "user.ts");

  assert.deepStrictEqual(
    [...unused[utilsDateFile]].sort(),
    ["FormatOptions"],
    "type-only interface from runtime module should be unused",
  );

  assert.deepStrictEqual(
    [...unused[modelsUserFile]].sort(),
    ["User"],
    "type-only referenced exports must be marked unused",
  );
});
