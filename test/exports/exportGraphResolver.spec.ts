import path from "node:path";

import { describe, expect, it } from "unrift";
import type { ResolvedExportEntry } from "../../src/core/exports/resolveExportGraph";
import { resolveExportGraph } from "../../src/core/exports/resolveExportGraph";
import { scanExports } from "../../src/core/exports/scanExports";
import { fixtures } from "../helpers/fixtures";
import { loadFiles } from "../helpers/loadFiles";

const FIXTURE_ROOT = fixtures("exports", "fixtures", "resolveGraphExports");

function getResolved(
  resolvedMap: Record<string, ResolvedExportEntry[]>,
  filePath: string,
): ResolvedExportEntry[] {
  const entries = resolvedMap[filePath];
  expect(entries).toBeDefined();
  return entries;
}

describe("resolveGraphExports", () => {
  it("resolves local named and default exports", () => {
    const files = loadFiles(FIXTURE_ROOT);
    const exportMap = scanExports(files);
    const resolved = resolveExportGraph(exportMap, files);

    const localFile = path.join(FIXTURE_ROOT, "localExports.ts");
    const entries = getResolved(resolved, localFile);

    const names = entries.map((e) => e.name).sort();
    expect(names).toEqual(["LOG_LEVEL", "createLogger", "default"]);

    const defaultEntry = entries.find((e) => e.name === "default");
    expect(defaultEntry).toBeDefined();
    expect(defaultEntry!.isDefault).toBe(true);
    expect(defaultEntry!.sourceFile).toBe(localFile);

    const logLevel = entries.find((e) => e.name === "LOG_LEVEL");
    expect(logLevel).toBeDefined();
    expect(logLevel!.originalName).toBe("LOG_LEVEL");
    expect(logLevel!.sourceFile).toBe(localFile);
    expect(logLevel!.exportChain).toEqual([]);
  });

  it("resolves named re-exports with alias", () => {
    const files = loadFiles(FIXTURE_ROOT);
    const exportMap = scanExports(files);
    const resolved = resolveExportGraph(exportMap, files);

    const sourceFile = path.join(FIXTURE_ROOT, "chainSource.ts");
    const aliasFile = path.join(FIXTURE_ROOT, "namedChainExport.ts");

    const aliasEntries = getResolved(resolved, aliasFile);

    const convertDate = aliasEntries.find((e) => e.name === "convertDate");
    expect(convertDate).toBeDefined();

    expect(convertDate!.originalName).toBe("formatDate");
    expect(convertDate!.sourceFile).toBe(sourceFile);
    expect(convertDate!.exportChain).toEqual([aliasFile]);
  });

  it("resolves multi-hop named re-export chains", () => {
    const files = loadFiles(FIXTURE_ROOT);
    const exportMap = scanExports(files);
    const resolved = resolveExportGraph(exportMap, files);

    const sourceFile = path.join(FIXTURE_ROOT, "chainSource.ts");
    const midFile = path.join(FIXTURE_ROOT, "chainMid.ts");
    const finalFile = path.join(FIXTURE_ROOT, "chainFinal.ts");

    const finalEntries = getResolved(resolved, finalFile);

    const finalExport = finalEntries.find((e) => e.name === "finalFormatDate");
    expect(finalExport).toBeDefined();

    expect(finalExport!.originalName).toBe("formatDate");
    expect(finalExport!.sourceFile).toBe(sourceFile);
    expect(finalExport!.exportChain).toEqual([finalFile, midFile]);
  });

  it("propagates named exports through wildcard re-exports", () => {
    const files = loadFiles(FIXTURE_ROOT);
    const exportMap = scanExports(files);
    const resolved = resolveExportGraph(exportMap, files);

    const sourceFile = path.join(FIXTURE_ROOT, "wildcardSource.ts");
    const barrelFile = path.join(FIXTURE_ROOT, "wildcardBarrel.ts");

    const barrelExports = getResolved(resolved, barrelFile);
    const barrelNames = barrelExports.map((e) => e.name).sort();

    expect(barrelNames).toEqual(["API_URL", "DEFAULT_TIMEOUT", "request"]);

    for (const name of ["API_URL", "DEFAULT_TIMEOUT", "request"]) {
      const entry = barrelExports.find((e) => e.name === name);
      expect(entry).toBeDefined();
      expect(entry!.sourceFile).toBe(sourceFile);
      expect(entry!.exportChain).toEqual([barrelFile]);
    }

    expect(barrelExports.some((e) => e.name === "default")).toBe(false);
  });

  it("handles cyclic re-exports safely", () => {
    const files = loadFiles(FIXTURE_ROOT);
    const exportMap = scanExports(files);

    expect(() => {
      resolveExportGraph(exportMap, files);
    }).not.toThrow();

    const resolved = resolveExportGraph(exportMap, files);

    const cycleOneFile = path.join(FIXTURE_ROOT, "cycleOne.ts");
    const cycleTwoFile = path.join(FIXTURE_ROOT, "cycleTwo.ts");

    const oneExports = getResolved(resolved, cycleOneFile);
    const twoExports = getResolved(resolved, cycleTwoFile);

    const hasOneLocal = oneExports.some((e) => e.name === "FIRST_FEATURE");
    const hasTwoLocal = twoExports.some((e) => e.name === "SECOND_FEATURE");

    expect(hasOneLocal).toBe(true);
    expect(hasTwoLocal).toBe(true);

    const maxAllowedChainLength = 3;
    for (const entry of [...oneExports, ...twoExports]) {
      expect(entry.exportChain.length <= maxAllowedChainLength).toBe(true);
    }
  });

  it("ignores unresolved re-export targets but keeps locals", () => {
    const files = loadFiles(FIXTURE_ROOT);
    const exportMap = scanExports(files);
    const resolved = resolveExportGraph(exportMap, files);

    const unresolvedFile = path.join(FIXTURE_ROOT, "unresolvedTarget.ts");
    const entries = getResolved(resolved, unresolvedFile);

    const names = entries.map((e) => e.name).sort();
    expect(names).toEqual(["FEATURE_FLAG"]);

    const flag = entries.find((e) => e.name === "FEATURE_FLAG");
    expect(flag).toBeDefined();
    expect(flag!.sourceFile).toBe(unresolvedFile);
    expect(flag!.exportChain).toEqual([]);
  });
});
