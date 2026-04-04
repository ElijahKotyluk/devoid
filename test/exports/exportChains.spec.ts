import path from "node:path";

import { analyzeExportUsage } from "../../src/core/exports/exportUsage";
import { scanExports } from "../../src/core/exports/scanExports";
import { buildImportGraph } from "../../src/core/imports/buildImportGraph";
import { loadTSConfig } from "../../src/core/tsconfig/tsconfigLoader";
import { fixtures } from "../helpers/fixtures";
import { loadFiles } from "../helpers/loadFiles";
import { describe, expect, it } from "unrift";

const fixturesRoot = fixtures("exports", "fixtures", "exportChains");

describe("export chains", () => {
  it("re-export chains: usage propagates through intermediate re-export modules", () => {
    const root = fixturesRoot;
    const files = loadFiles(root);

    const tsConfig = loadTSConfig(root);
    const importGraph = buildImportGraph(files, tsConfig);
    const exportMap = scanExports(files);

    const { used, unused } = analyzeExportUsage(exportMap, importGraph);

    const sourceFile = path.join(root, "formatting.ts");
    const bridgeFile = path.join(root, "formattingBridge.ts");

    expect(used[bridgeFile].has("canonicalizeEmail")).toBe(true);

    expect(used[sourceFile].has("normalizeEmail")).toBe(true);
    expect(used[sourceFile].has("formatUserName")).toBe(false);

    expect(unused[sourceFile].has("formatUserName")).toBe(true);
  });
});
