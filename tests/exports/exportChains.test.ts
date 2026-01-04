import assert from "assert";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { analyzeExportUsage } from "../../src/core/exports/exportUsage";
import { scanExports } from "../../src/core/exports/scanExports";
import { buildImportGraph } from "../../src/core/imports/buildImportGraph";
import { loadTSConfig } from "../../src/core/tsconfig/tsconfigLoader";

const fixturesRoot = path.join(__dirname, "fixtures", "exportChains");

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

test("re-export chains: usage propagates through intermediate re-export modules", () => {
  const root = fixturesRoot;
  const files = loadFiles(root);

  const tsConfig = loadTSConfig(root);
  const importGraph = buildImportGraph(files, tsConfig);
  const exportMap = scanExports(files);

  const { used, unused } = analyzeExportUsage(exportMap, importGraph);

  const sourceFile = path.join(root, "formatting.ts");
  const bridgeFile = path.join(root, "formattingBridge.ts");

  assert(used[bridgeFile].has("canonicalizeEmail"));

  assert(used[sourceFile].has("normalizeEmail"));
  assert(!used[sourceFile].has("formatUserName"));

  assert(unused[sourceFile].has("formatUserName"));
});
