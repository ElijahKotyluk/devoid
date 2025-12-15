import assert from "assert/strict";
import fs from "fs";
import test from "node:test";
import path from "path";

import { analyzeProject } from "../../src/core/analyzer.js";

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

const FIXTURE_ROOT = path.join(__dirname, "fixtures", "barrel");

function analyze(root: string) {
  const files = loadFiles(root);
  return analyzeProject(root, { ignore: [] });
}

test("barrel modules: pure barrel is not considered unused", () => {
  const project = analyze(FIXTURE_ROOT);

  const unusedFiles = new Set(project.unusedFiles);
  const barrel = path.join(FIXTURE_ROOT, "pure", "index.ts");

  assert(!unusedFiles.has(barrel), "pure barrel should NOT be flagged unused");
});

test("barrel modules: mixed barrel retains and reports local exports", () => {
  const project = analyze(FIXTURE_ROOT);
  const unusedExports = new Set(project.unusedExports.map((e) => e.name));

  // local export inside mixed/index.ts
  assert(unusedExports.has("UNUSED_LOCAL"), "UNUSED_LOCAL should be marked unused");
});

test("barrel modules: multi-source barrels forward dependencies correctly", () => {
  const project = analyze(FIXTURE_ROOT);

  const unusedExports = new Set(project.unusedExports.map((e) => `${e.file}:${e.name}`));

  const aFn = path.join(FIXTURE_ROOT, "multi", "a.ts") + ":fnA";
  const bFn = path.join(FIXTURE_ROOT, "multi", "b.ts") + ":fnB";

  assert(!unusedExports.has(aFn), "fnA should be used via barrel");
  assert(!unusedExports.has(bFn), "fnB should be used via barrel");
});

test("barrel modules: unused barrel file is detected", () => {
  const project = analyze(FIXTURE_ROOT);

  const unusedFiles = new Set(project.unusedFiles);
  const barrel = path.join(FIXTURE_ROOT, "unused", "index.ts");

  assert(unusedFiles.has(barrel), "unused barrel should be marked unused");
});

test("barrel modules: mixed named + wildcard re-exports propagate properly", () => {
  const project = analyze(FIXTURE_ROOT);

  const unused = new Set(project.unusedExports.map((e) => e.name));

  assert(!unused.has("alpha"), "alpha should be used");
  assert(!unused.has("beta"), "beta should be used");
  assert(!unused.has("gamma"), "gamma should be used");
});
