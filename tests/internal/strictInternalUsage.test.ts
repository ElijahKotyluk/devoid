import assert from "assert";
import fs from "fs";
import test from "node:test";
import path from "path";

import { analyzeLocalUsage } from "../../src/core/locals/analyzeLocalUsage";

const fixturesRoot = path.join(__dirname, "fixtures", "strict");

test("strict internal usage: trackAllLocals includes typed variables", () => {
  const filePath = path.join(fixturesRoot, "example.ts");
  const sourceText = fs.readFileSync(filePath, "utf8");

  const result = analyzeLocalUsage(filePath, sourceText, {
    trackAllLocals: true,
  });

  const declared = new Set(result.declared);
  const unused = new Set(result.unused);

  assert(declared.has("compute"));
  assert(declared.has("neverCalled"));
  assert(declared.has("result"));
  assert(declared.has("neverUsed"));

  assert(unused.has("neverCalled"));
  assert(unused.has("neverUsed"));
});
