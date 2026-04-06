import path from "node:path";

import { describe, expect, it } from "unrift";
import { buildImportGraph } from "../../src/core/imports/buildImportGraph";
import { loadTSConfig } from "../../src/core/tsconfig/tsconfigLoader";
import { fixtures } from "../helpers/fixtures";
import { loadFiles } from "../helpers/loadFiles";

const fixturesRoot = fixtures("imports", "fixtures", "importGraph");

describe("import graph", () => {
  it("resolves relative and directory imports", () => {
    const root = fixturesRoot;
    const files = loadFiles(root);

    const tsConfig = loadTSConfig(root);
    const graph = buildImportGraph(files, tsConfig);

    const mainFile = path.join(root, "main.ts");
    const entries = graph[mainFile];
    expect(entries).toBeDefined();

    const utilsDateFile = path.join(root, "utils", "date.ts");
    const utilsIndexFile = path.join(root, "utils", "index.ts");
    const modelsUserFile = path.join(root, "models", "user.ts");

    const targets = new Set(entries.map((e) => e.sourceFile));

    expect(targets.has(utilsDateFile)).toBe(true);
    expect(targets.has(utilsIndexFile)).toBe(true);
    expect(targets.has(modelsUserFile)).toBe(false);
  });

  it("type-only imports are ignored for runtime usage", () => {
    const root = fixtures("imports", "fixtures", "types");
    const files = loadFiles(root);

    const graph = buildImportGraph(files, {});

    const userTypes = path.join(root, "userTypes.ts");
    const userService = path.join(root, "userService.ts");

    expect(graph[userService]).toEqual([]);

    const allTargets = Object.values(graph).flatMap((records) => records.map((r) => r.sourceFile));
    expect(allTargets.includes(userTypes)).toBe(false);
  });
});
