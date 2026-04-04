import path from "node:path";

import { analyzeExportUsage } from "../../src/core/exports/exportUsage";
import { scanExports } from "../../src/core/exports/scanExports";
import { buildImportGraph } from "../../src/core/imports/buildImportGraph";
import { loadTSConfig } from "../../src/core/tsconfig/tsconfigLoader";
import { fixtures } from "../helpers/fixtures";
import { loadFiles } from "../helpers/loadFiles";
import { describe, expect, it } from "unrift";

const fixturesRoot = fixtures("exports", "fixtures", "simple");

describe("export usage", () => {
  it("detects used and unused named/default exports", () => {
    const root = fixturesRoot;
    const files = loadFiles(root);

    const tsConfig = loadTSConfig(root);
    const importGraph = buildImportGraph(files, tsConfig);
    const exportMap = scanExports(files);

    const { used, unused } = analyzeExportUsage(exportMap, importGraph);

    const mathFile = path.join(root, "math.ts");
    const loggerFile = path.join(root, "logger.ts");

    expect([...used[mathFile]].sort()).toEqual(["add"]);
    expect([...unused[mathFile]].sort()).toEqual(["subtract"]);

    expect([...used[loggerFile]].sort()).toEqual(["debug", "default"]);
    expect(unused[loggerFile].has("default")).toBe(false);
    expect(used[loggerFile].has("default")).toBe(true);

    expect(used[loggerFile].has("debug")).toBe(true);
  });
});
