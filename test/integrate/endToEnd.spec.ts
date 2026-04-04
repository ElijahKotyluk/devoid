import path from "node:path";

import { analyzeProject } from "../../src/core/analyzer";
import { fixtures } from "../helpers/fixtures";
import { describe, expect, it } from "unrift";

const projectRoot = fixtures("integrate", "fixtures", "project", "src");

describe("end-to-end", () => {
  it("detects unused exports and files in a small project", () => {
    const results = analyzeProject(projectRoot, {});

    const unusedExports = results.unusedExports;
    const unusedFiles = results.unusedFiles;

    const unusedExportNames = new Set(unusedExports.map((e) => `${e.file}:${e.name}`));

    expect(
      unusedExportNames.has(path.join(projectRoot, "utils", "math.ts") + ":multiply"),
    ).toBe(true);
    expect(
      unusedExportNames.has(path.join(projectRoot, "utils", "unused.ts") + ":unusedHelper"),
    ).toBe(true);

    const unusedFileSet = new Set(unusedFiles);
    expect(unusedFileSet.has(path.join(projectRoot, "utils", "unused.ts"))).toBe(true);
  });
});
