import assert from "assert";
import path from "node:path";
import test from "node:test";

import { analyzeProject } from "../../src/core/analyzer";

const projectRoot = path.join(__dirname, "fixtures", "project", "src");

test("end-to-end: detects unused exports and files in a small project", () => {
  const results = analyzeProject(projectRoot, {});

  const unusedExports = results.unusedExports;
  const unusedFiles = results.unusedFiles;

  const unusedExportNames = new Set(unusedExports.map((e) => `${e.file}:${e.name}`));

  assert(unusedExportNames.has(path.join(projectRoot, "utils", "math.ts") + ":multiply"));
  assert(unusedExportNames.has(path.join(projectRoot, "utils", "unused.ts") + ":unusedHelper"));

  const unusedFileSet = new Set(unusedFiles);
  assert(unusedFileSet.has(path.join(projectRoot, "utils", "unused.ts")));
});
