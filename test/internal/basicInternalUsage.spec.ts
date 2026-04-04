import fs from "node:fs";
import path from "node:path";

import { analyzeLocalUsage } from "../../src/core/locals/analyzeLocalUsage";
import { fixtures } from "../helpers/fixtures";
import { describe, expect, it } from "unrift";

const fixturesRoot = fixtures("internal", "fixtures", "basic");

describe("basic internal usage", () => {
  it("detects unused functions and variables", () => {
    const filePath = path.join(fixturesRoot, "example.ts");
    const sourceText = fs.readFileSync(filePath, "utf8");

    const result = analyzeLocalUsage(filePath, sourceText, {
      trackAllLocals: false,
    });

    const declared = new Set(result.declared);
    const referenced = new Set(result.referenced);
    const unused = new Set(result.unused);

    expect(declared.has("usedFunction")).toBe(true);
    expect(declared.has("unusedFunction")).toBe(true);
    expect(declared.has("usedValue")).toBe(true);
    expect(declared.has("unusedValue")).toBe(true);

    expect(referenced.has("usedFunction")).toBe(true);
    expect(referenced.has("usedValue")).toBe(true);

    expect(unused.has("unusedFunction")).toBe(true);
    expect(unused.has("unusedValue")).toBe(true);
  });
});
