import path from "node:path";

import { analyzeExportUsage } from "../../src/core/exports/exportUsage";
import { scanExports } from "../../src/core/exports/scanExports";
import { buildImportGraph } from "../../src/core/imports/buildImportGraph";
import { loadTSConfig } from "../../src/core/tsconfig/tsconfigLoader";
import { fixtures } from "../helpers/fixtures";
import { loadFiles } from "../helpers/loadFiles";
import { describe, expect, it } from "unrift";

const root = fixtures("imports", "fixtures", "mixedImports");

describe("mixed imports", () => {
  it("runtime imports create edges, type imports do not", () => {
    const files = loadFiles(root);

    const tsConfig = loadTSConfig(root);
    const graph = buildImportGraph(files, tsConfig);

    const consumerFile = path.join(root, "consumer.ts");
    const imports = graph[consumerFile] ?? [];

    const targets = new Set(imports.map((i) => i.sourceFile));

    const utilsDateFile = path.join(root, "utils", "date.ts");
    const modelsUserFile = path.join(root, "models", "user.ts");

    expect(targets.has(utilsDateFile)).toBe(true);

    const importedSymbols = imports.flatMap((i) => i.imported);
    expect(importedSymbols.sort()).toEqual(["formatDate"]);

    expect(targets.has(modelsUserFile)).toBe(false);
  });

  it("runtime usage marks exports as used, type-only does not", () => {
    const files = loadFiles(root);

    const tsConfig = loadTSConfig(root);
    const importGraph = buildImportGraph(files, tsConfig);
    const exportMap = scanExports(files);

    const { unused } = analyzeExportUsage(exportMap, importGraph);

    const utilsDateFile = path.join(root, "utils", "date.ts");
    const modelsUserFile = path.join(root, "models", "user.ts");

    expect([...unused[utilsDateFile]].sort()).toEqual(["FormatOptions"]);
    expect([...unused[modelsUserFile]].sort()).toEqual(["User"]);
  });
});
