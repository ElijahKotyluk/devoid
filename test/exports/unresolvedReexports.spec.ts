import path from "node:path";

import type { ResolvedExportEntry } from "../../src/core/exports/resolveExportGraph";
import { resolveExportGraph } from "../../src/core/exports/resolveExportGraph";
import { scanExports } from "../../src/core/exports/scanExports";
import { fixtures } from "../helpers/fixtures";
import { loadFiles } from "../helpers/loadFiles";
import { describe, expect, it } from "unrift";

const FIXTURES = fixtures("exports", "fixtures", "unresolved");

function getResolved(
  resolved: Record<string, ResolvedExportEntry[]>,
  file: string,
): ResolvedExportEntry[] {
  expect(resolved[file]).toBeDefined();
  return resolved[file];
}

describe("unresolved re-exports", () => {
  it("ignores unresolved re-export targets but preserves locals", () => {
    const files = loadFiles(FIXTURES);
    const exportMap = scanExports(files);

    expect(() => {
      resolveExportGraph(exportMap, files);
    }).not.toThrow();

    const resolved = resolveExportGraph(exportMap, files);

    const unresolvedFile = path.join(FIXTURES, "target.ts");

    const entries = getResolved(resolved, unresolvedFile);
    const names = entries.map((e) => e.name).sort();

    expect(names).toEqual(["FEATURE_FLAG"]);

    const flag = entries.find((e) => e.name === "FEATURE_FLAG")!;
    expect(flag.originalName).toBe("FEATURE_FLAG");
    expect(flag.sourceFile).toBe(unresolvedFile);
    expect(flag.exportChain).toEqual([]);
  });
});
