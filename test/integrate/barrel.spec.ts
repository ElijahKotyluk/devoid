import path from "node:path";

import { describe, expect, it } from "unrift";
import { analyzeProject } from "../../src/core/analyzer";
import { fixtures } from "../helpers/fixtures";

const FIXTURE_ROOT = fixtures("integrate", "fixtures", "barrel");

function analyze() {
  return analyzeProject(FIXTURE_ROOT, { ignore: [] });
}

describe("barrel modules", () => {
  it("pure barrel is not considered unused", () => {
    const project = analyze();

    const unusedFiles = new Set(project.unusedFiles);
    const barrel = path.join(FIXTURE_ROOT, "pure", "index.ts");

    expect(unusedFiles.has(barrel)).toBe(false);
  });

  it("mixed barrel retains and reports local exports", () => {
    const project = analyze();
    const unusedExports = new Set(project.unusedExports.map((e) => e.name));

    expect(unusedExports.has("UNUSED_LOCAL")).toBe(true);
  });

  it("multi-source barrels forward dependencies correctly", () => {
    const project = analyze();

    const unusedExports = new Set(project.unusedExports.map((e) => `${e.file}:${e.name}`));

    const aFn = path.join(FIXTURE_ROOT, "multi", "a.ts") + ":fnA";
    const bFn = path.join(FIXTURE_ROOT, "multi", "b.ts") + ":fnB";

    expect(unusedExports.has(aFn)).toBe(false);
    expect(unusedExports.has(bFn)).toBe(false);
  });

  it("unused barrel file is detected", () => {
    const project = analyze();

    const unusedFiles = new Set(project.unusedFiles);
    const barrel = path.join(FIXTURE_ROOT, "unused", "index.ts");

    expect(unusedFiles.has(barrel)).toBe(true);
  });

  it("mixed named + wildcard re-exports propagate properly", () => {
    const project = analyze();

    const unused = new Set(project.unusedExports.map((e) => e.name));

    expect(unused.has("alpha")).toBe(false);
    expect(unused.has("beta")).toBe(false);
    expect(unused.has("gamma")).toBe(false);
  });

  it("re-export target is not considered unused", () => {
    const project = analyze();
    const unusedFiles = new Set(project.unusedFiles);

    const utilPath = path.join(FIXTURE_ROOT, "shared", "util.ts");

    expect(unusedFiles.has(utilPath)).toBe(false);
  });
});
