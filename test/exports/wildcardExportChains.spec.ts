import path from "node:path";

import { describe, expect, it } from "unrift";
import { analyzeExportUsage } from "../../src/core/exports/exportUsage";
import { scanExports } from "../../src/core/exports/scanExports";
import { buildImportGraph } from "../../src/core/imports/buildImportGraph";
import { loadTSConfig } from "../../src/core/tsconfig/tsconfigLoader";
import { fixtures } from "../helpers/fixtures";
import { loadFiles } from "../helpers/loadFiles";

const fixturesRoot = fixtures("exports", "fixtures", "wildcard");

describe("wildcard export chains", () => {
  it("usage propagates from consumer through index to source", () => {
    const root = fixturesRoot;
    const files = loadFiles(root);

    const tsConfig = loadTSConfig(root);
    const importGraph = buildImportGraph(files, tsConfig);
    const exportMap = scanExports(files);

    const { used, unused } = analyzeExportUsage(exportMap, importGraph);

    const controllerFile = path.join(root, "controller.ts");
    const indexFile = path.join(root, "index.ts");

    expect(used[controllerFile].has("getUser")).toBe(true);
    expect(used[controllerFile].has("createUser")).toBe(true);

    expect(unused[controllerFile].size).toBe(0);

    expect(used[indexFile].size > 0).toBe(true);
  });
});
