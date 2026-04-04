import fs from "node:fs";
import path from "node:path";

import { analyzeLocalUsage } from "../../src/core/locals/analyzeLocalUsage";
import { fixtures } from "../helpers/fixtures";
import { describe, expect, it } from "unrift";

const fixturesRoot = fixtures("internal", "fixtures", "strict");

describe("strict internal usage", () => {
  it("trackAllLocals includes typed variables", () => {
    const filePath = path.join(fixturesRoot, "example.ts");
    const sourceText = fs.readFileSync(filePath, "utf8");

    const result = analyzeLocalUsage(filePath, sourceText, {
      trackAllLocals: true,
    });

    const declared = new Set(result.declared);
    const unused = new Set(result.unused);

    expect(declared.has("compute")).toBe(true);
    expect(declared.has("neverCalled")).toBe(true);
    expect(declared.has("result")).toBe(true);
    expect(declared.has("neverUsed")).toBe(true);

    expect(unused.has("neverCalled")).toBe(true);
    expect(unused.has("neverUsed")).toBe(true);
  });
});
