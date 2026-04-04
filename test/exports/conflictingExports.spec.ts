import path from "node:path";

import type { ResolvedExportEntry } from "../../src/core/exports/resolveExportGraph";
import { resolveExportGraph } from "../../src/core/exports/resolveExportGraph";
import { scanExports } from "../../src/core/exports/scanExports";
import { fixtures } from "../helpers/fixtures";
import { loadFiles } from "../helpers/loadFiles";
import { describe, expect, it } from "unrift";

const FIX = fixtures("exports", "fixtures", "conflictingExports");

function resolvedFor(map: Record<string, ResolvedExportEntry[]>, file: string) {
  const entries = map[file];
  expect(entries).toBeDefined();
  return entries;
}

describe("conflicting exports", () => {
  it("later wildcard re-export overwrites earlier", () => {
    const files = loadFiles(FIX);
    const exportMap = scanExports(files);
    const resolved = resolveExportGraph(exportMap, files);

    const barrel = path.join(FIX, "aggregatedConfig.ts");
    const featureFlags = path.join(FIX, "featureFlags.ts");

    const entries = resolvedFor(resolved, barrel);
    const names = entries.map((e) => e.name).sort();

    expect(names).toEqual(["APP_THEME"]);

    const entry = entries.find((e) => e.name === "APP_THEME")!;
    expect(entry.sourceFile).toBe(featureFlags);
  });

  it("explicit re-export overrides wildcard", () => {
    const files = loadFiles(FIX);
    const exportMap = scanExports(files);
    const resolved = resolveExportGraph(exportMap, files);

    const overrideConfig = path.join(FIX, "overrideConfig.ts");
    const userSettings = path.join(FIX, "userSettings.ts");

    const entries = resolvedFor(resolved, overrideConfig);
    const entry = entries.find((e) => e.name === "APP_THEME")!;

    expect(entry.sourceFile).toBe(userSettings);
  });

  it("default re-exported under alias resolves correctly", () => {
    const files = loadFiles(FIX);
    const exportMap = scanExports(files);
    const resolved = resolveExportGraph(exportMap, files);

    const facade = path.join(FIX, "loggingFacade.ts");
    const loggerFile = path.join(FIX, "logger.ts");

    const entries = resolvedFor(resolved, facade);

    const names = entries.map((e) => e.name).sort();
    expect(names).toEqual(["Logger"]);

    const entry = entries.find((e) => e.name === "Logger")!;
    expect(entry.originalName).toBe("default");
    expect(entry.sourceFile).toBe(loggerFile);
  });
});
