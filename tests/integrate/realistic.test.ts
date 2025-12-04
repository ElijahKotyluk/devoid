import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { analyzeProject } from "../../src/core/analyzer.js";

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

const ROOT = path.join(__dirname, "fixtures", "realistic");

test("integration: realistic small project", () => {
  const results = analyzeProject(ROOT, {});

  const unusedExports = results.unusedExports;
  const unusedFiles = results.unusedFiles;
  const unusedIdentifiers = results.unusedIdentifiers;
  const unusedExportNames = new Set(unusedExports.map((e) => e.name));

  assert(!unusedExportNames.has("formatDate"));
  assert(unusedExportNames.has("getUserProfile"));

  const mathFile = path.join(ROOT, "utils", "math.ts");
  const unusedFromMath = unusedExports
    .filter((e) => e.file === mathFile)
    .map((e) => e.name)
    .sort();

  assert.deepEqual(unusedFromMath, ["add", "multiply"]);

  const internalTempLocal = unusedIdentifiers.find((id) => id.endsWith(":internalTemp"));
  assert.ok(internalTempLocal);

  const unusedValueLocal = unusedIdentifiers.find((id) => id.endsWith(":unusedValue"));
  assert.ok(unusedValueLocal);

  const internalHelperFile = path.join(ROOT, "internal", "helper.ts");
  assert(unusedFiles.includes(internalHelperFile));
});
