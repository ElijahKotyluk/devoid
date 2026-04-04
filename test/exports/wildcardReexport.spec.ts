import path from "node:path";

import type { ResolvedExportEntry } from "../../src/core/exports/resolveExportGraph";
import { resolveExportGraph } from "../../src/core/exports/resolveExportGraph";
import { scanExports } from "../../src/core/exports/scanExports";
import { fixtures } from "../helpers/fixtures";
import { loadFiles } from "../helpers/loadFiles";
import { describe, expect, it } from "unrift";

const FIXTURES = fixtures("exports", "fixtures", "wildcardReexports");

function getResolved(
  resolved: Record<string, ResolvedExportEntry[]>,
  file: string,
): ResolvedExportEntry[] {
  expect(resolved[file]).toBeDefined();
  return resolved[file];
}

describe("wildcard re-exports", () => {
  it("propagate named exports but exclude default", () => {
    const files = loadFiles(FIXTURES);
    const exportMap = scanExports(files);
    const resolved = resolveExportGraph(exportMap, files);

    const sourceFile = path.join(FIXTURES, "wildcardSource.ts");
    const barrelFile = path.join(FIXTURES, "wildcardBarrel.ts");

    const barrelExports = getResolved(resolved, barrelFile);

    const expectedNames = ["API_URL", "DEFAULT_TIMEOUT", "request"].sort();
    const actualNames = barrelExports.map((e) => e.name).sort();

    expect(actualNames).toEqual(expectedNames);

    for (const name of expectedNames) {
      const entry = barrelExports.find((e) => e.name === name);
      expect(entry).toBeDefined();
      expect(entry!.sourceFile).toBe(sourceFile);
      expect(entry!.exportChain).toEqual([barrelFile]);
    }

    expect(barrelExports.some((e) => e.name === "default")).toBe(false);
  });
});
