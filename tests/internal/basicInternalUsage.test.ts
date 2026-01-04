import assert from "assert";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { analyzeLocalUsage } from "../../src/core/locals/analyzeLocalUsage";

const fixturesRoot = path.join(__dirname, "fixtures", "basic");

test("basic internal usage: detects unused functions and variables", () => {
  const filePath = path.join(fixturesRoot, "example.ts");
  const sourceText = fs.readFileSync(filePath, "utf8");

  const result = analyzeLocalUsage(filePath, sourceText, {
    trackAllLocals: false,
  });

  const declared = new Set(result.declared);
  const referenced = new Set(result.referenced);
  const unused = new Set(result.unused);

  assert(declared.has("usedFunction"));
  assert(declared.has("unusedFunction"));
  assert(declared.has("usedValue"));
  assert(declared.has("unusedValue"));

  assert(referenced.has("usedFunction"));
  assert(referenced.has("usedValue"));

  assert(unused.has("unusedFunction"));
  assert(unused.has("unusedValue"));
});
