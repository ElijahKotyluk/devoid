import assert from "assert/strict";
import fs from "fs";
import test from "node:test";
import path from "path";

import { resolveExportGraph } from "../../src/core/exports/resolveExportGraph.js";
import { scanExports } from "../../src/core/exports/scanExports.js";

const root = path.join(__dirname, "fixtures", "localPriority");

function loadFiles(dir: string): string[] {
  const out: string[] = [];

  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);

    if (filePath.endsWith(".ts")) out.push(filePath);
  }

  return out;
}

test("local declarations override everything", () => {
  const files = loadFiles(root);
  const exportMap = scanExports(files);
  const resolved = resolveExportGraph(exportMap, files);

  const index = path.join(root, "index.ts");
  const entries = resolved[index];

  const localAdd = entries.find((e) => e.name === "add");
  assert.ok(localAdd);
  assert.equal(localAdd.sourceFile, index);
});
