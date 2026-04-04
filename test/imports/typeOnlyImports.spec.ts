import path from "node:path";

import { analyzeExportUsage } from "../../src/core/exports/exportUsage";
import { scanExports } from "../../src/core/exports/scanExports";
import { buildImportGraph } from "../../src/core/imports/buildImportGraph";
import { loadTSConfig } from "../../src/core/tsconfig/tsconfigLoader";
import { fixtures } from "../helpers/fixtures";
import { loadFiles } from "../helpers/loadFiles";
import { describe, expect, it } from "unrift";

const root = fixtures("imports", "fixtures", "typeOnly");

describe("type-only imports", () => {
  it("produce no import graph edges", () => {
    const files = loadFiles(root);

    const tsConfig = loadTSConfig(root);
    const graph = buildImportGraph(files, tsConfig);

    const consumerFile = path.join(root, "consumer.ts");
    const imports = graph[consumerFile];

    expect(imports.length).toBe(0);
  });

  it("do not mark exports as used", () => {
    const files = loadFiles(root);

    const tsConfig = loadTSConfig(root);
    const importGraph = buildImportGraph(files, tsConfig);
    const exportMap = scanExports(files);

    const { unused } = analyzeExportUsage(exportMap, importGraph);

    const modelFile = path.join(root, "models", "user.ts");
    const unusedExports = [...unused[modelFile]];

    expect(unusedExports.sort()).toEqual(["User"]);
  });
});
