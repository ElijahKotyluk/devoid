import path from "node:path";

import type { ResolvedExportEntry } from "../../src/core/exports/resolveExportGraph";
import { resolveExportGraph } from "../../src/core/exports/resolveExportGraph";
import { scanExports } from "../../src/core/exports/scanExports";
import { fixtures } from "../helpers/fixtures";
import { loadFiles } from "../helpers/loadFiles";
import { describe, expect, it } from "unrift";

const FIXTURES = fixtures("exports", "fixtures", "multiHop");

function getResolved(
  resolved: Record<string, ResolvedExportEntry[]>,
  file: string,
): ResolvedExportEntry[] {
  expect(resolved[file]).toBeDefined();
  return resolved[file];
}

describe("multi-hop", () => {
  it("named re-exports: source -> mid -> final", () => {
    const files = loadFiles(FIXTURES);
    const exportMap = scanExports(files);
    const resolved = resolveExportGraph(exportMap, files);

    const sourceFile = path.join(FIXTURES, "chainSource.ts");
    const midFile = path.join(FIXTURES, "chainMid.ts");
    const finalFile = path.join(FIXTURES, "chainFinal.ts");

    const finalExports = getResolved(resolved, finalFile);

    const finalEntry = finalExports.find((e) => e.name === "finalFormatDate");
    expect(finalEntry).toBeDefined();

    expect(finalEntry!.originalName).toBe("formatDate");
    expect(finalEntry!.sourceFile).toBe(sourceFile);
    expect(finalEntry!.exportChain).toEqual([finalFile, midFile]);
  });
});
