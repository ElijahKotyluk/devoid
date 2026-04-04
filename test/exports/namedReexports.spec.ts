import path from "node:path";

import type { ResolvedExportEntry } from "../../src/core/exports/resolveExportGraph";
import { resolveExportGraph } from "../../src/core/exports/resolveExportGraph";
import { scanExports } from "../../src/core/exports/scanExports";
import { fixtures } from "../helpers/fixtures";
import { loadFiles } from "../helpers/loadFiles";
import { describe, expect, it } from "unrift";

const FIXTURES = fixtures("exports", "fixtures", "namedReexports");

function getResolved(
  resolved: Record<string, ResolvedExportEntry[]>,
  file: string,
): ResolvedExportEntry[] {
  expect(resolved[file]).toBeDefined();
  return resolved[file];
}

describe("named re-exports", () => {
  it("alias resolves to the original source", () => {
    const files = loadFiles(FIXTURES);
    const exportMap = scanExports(files);
    const resolved = resolveExportGraph(exportMap, files);

    const sourceFile = path.join(FIXTURES, "chainSource.ts");
    const aliasFile = path.join(FIXTURES, "namedChainExport.ts");

    const aliasExports = getResolved(resolved, aliasFile);

    const convertDate = aliasExports.find((e) => e.name === "convertDate");
    expect(convertDate).toBeDefined();

    expect(convertDate!.originalName).toBe("formatDate");
    expect(convertDate!.sourceFile).toBe(sourceFile);
    expect(convertDate!.exportChain).toEqual([aliasFile]);
  });
});
