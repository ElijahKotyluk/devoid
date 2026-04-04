import path from "node:path";

import { analyzeExportUsage } from "../../src/core/exports/exportUsage";
import { scanExports } from "../../src/core/exports/scanExports";
import { buildImportGraph } from "../../src/core/imports/buildImportGraph";
import { loadTSConfig } from "../../src/core/tsconfig/tsconfigLoader";
import { fixtures } from "../helpers/fixtures";
import { loadFiles } from "../helpers/loadFiles";
import { describe, expect, it } from "unrift";

const fixturesRoot = fixtures("imports", "fixtures", "unresolved");

describe("unresolved imports", () => {
  it("external modules do not affect export usage", () => {
    const root = fixturesRoot;
    const files = loadFiles(root);

    const tsConfig = loadTSConfig(root);
    const importGraph = buildImportGraph(files, tsConfig);
    const exportMap = scanExports(files);

    const { used, unused } = analyzeExportUsage(exportMap, importGraph);

    const localFile = path.join(root, "local.ts");
    expect([...used[localFile]].sort()).toEqual(["localFn"]);
    expect([...unused[localFile]]).toEqual([]);
  });
});
