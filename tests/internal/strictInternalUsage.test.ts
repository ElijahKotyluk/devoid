import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

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
