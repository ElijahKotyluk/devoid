import assert from "assert";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildImportGraph } from "../../src/core/imports/buildImportGraph";
import { loadTSConfig } from "../../src/core/tsconfig/tsconfigLoader";

const fixturesRoot = path.join(__dirname, "fixtures", "importGraph");

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

test("import graph: resolves relative and directory imports", () => {
  const root = fixturesRoot;
  const files = loadFiles(root);

  const tsConfig = loadTSConfig(root);
  const graph = buildImportGraph(files, tsConfig);

  const mainFile = path.join(root, "main.ts");
  const entries = graph[mainFile];
  assert(entries);

  const utilsDateFile = path.join(root, "utils", "date.ts");
  const utilsIndexFile = path.join(root, "utils", "index.ts");
  const modelsUserFile = path.join(root, "models", "user.ts");

  const targets = new Set(entries.map((e) => e.sourceFile));

  assert(targets.has(utilsDateFile));
  assert(targets.has(utilsIndexFile));
  assert(!targets.has(modelsUserFile));
});

test("import graph: type-only imports are ignored for runtime usage", () => {
  const root = path.join(__dirname, "fixtures", "types");
  const files = loadFiles(root);

  const graph = buildImportGraph(files, {});

  const userTypes = path.join(root, "userTypes.ts");
  const userService = path.join(root, "userService.ts");

  // userService.ts has an `import type { ... }`, but that should not
  // create a runtime import edge.
  assert.deepStrictEqual(
    graph[userService],
    [],
    "type-only imports should not create import edges",
  );

  // And userTypes.ts should not appear as a target in any import record.
  const allTargets = Object.values(graph).flatMap((records) => records.map((r) => r.sourceFile));
  assert(
    !allTargets.includes(userTypes),
    "type-only import source file should not appear in the runtime import graph",
  );
});
