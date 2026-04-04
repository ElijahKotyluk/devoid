import path from "node:path";

import { analyzeProject } from "../../src/core/analyzer";
import { fixtures } from "../helpers/fixtures";
import { describe, expect, it } from "unrift";

const ROOT = fixtures("integrate", "fixtures", "realistic");

describe("integration: realistic small project", () => {
  it("detects unused exports, files, and identifiers", () => {
    const results = analyzeProject(ROOT, {});

    const unusedExports = results.unusedExports;
    const unusedFiles = results.unusedFiles;
    const unusedIdentifiers = results.unusedIdentifiers;
    const unusedExportNames = new Set(unusedExports.map((e) => e.name));

    expect(unusedExportNames.has("formatDate")).toBe(false);
    expect(unusedExportNames.has("getUserProfile")).toBe(true);

    const mathFile = path.join(ROOT, "utils", "math.ts");
    const unusedFromMath = unusedExports
      .filter((e) => e.file === mathFile)
      .map((e) => e.name)
      .sort();

    expect(unusedFromMath).toEqual(["add", "multiply"]);

    const internalTempLocal = unusedIdentifiers.find((id) => id.endsWith(":internalTemp"));
    expect(internalTempLocal).toBeDefined();

    const unusedValueLocal = unusedIdentifiers.find((id) => id.endsWith(":unusedValue"));
    expect(unusedValueLocal).toBeDefined();

    const internalHelperFile = path.join(ROOT, "internal", "helper.ts");
    expect(unusedFiles.includes(internalHelperFile)).toBe(true);
  });
});
