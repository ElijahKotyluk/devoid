import assert from "assert/strict";
import path from "node:path";
import test from "node:test";

import { runCLI } from "./utils/runCLI";

const FIXTURE_ROOT = path.join(__dirname, "fixtures", "types");

test("devoid: without --types flag, type results are not included", async () => {
  const res = await runCLI([FIXTURE_ROOT, "--json"]);
  assert.equal(res.code, 0);

  const parsed = JSON.parse(res.stdout);

  assert.equal("unusedExportedTypes" in parsed, false);
  assert.equal("unusedLocalTypes" in parsed, false);
});

test("devoid: --types reports unused exported and unused local types", async () => {
  const res = await runCLI([FIXTURE_ROOT, "--types", "--json"]);

  assert.equal(res.code, 0);

  const parsed = JSON.parse(res.stdout);

  assert.ok(Array.isArray(parsed.unusedExportedTypes), "expected unusedExportedTypes array");
  assert.ok(Array.isArray(parsed.unusedLocalTypes), "expected unusedLocalTypes array");

  const unusedExported = new Set(parsed.unusedExportedTypes.map((e: any) => `${e.file}:${e.name}`));
  const unusedLocal = new Set(parsed.unusedLocalTypes.map((e: any) => `${e.file}:${e.name}`));

  const typesFile = path.join(FIXTURE_ROOT, "types.ts");

  // Exported types
  assert(!unusedExported.has(`${typesFile}:UsedExported`), "UsedExported should be used");
  assert(unusedExported.has(`${typesFile}:UnusedExported`), "UnusedExported should be unused");

  // Local types
  assert(!unusedLocal.has(`${typesFile}:UsedLocal`), "UsedLocal should be used (via Wrapper)");
  assert(unusedLocal.has(`${typesFile}:UnusedLocal`), "UnusedLocal should be unused");
});

test("devoid: --types respects barrel type re-exports", async () => {
  const res = await runCLI([FIXTURE_ROOT, "--types", "--json"]);
  assert.equal(res.code, 0);

  const parsed = JSON.parse(res.stdout);

  const unusedExported = new Set(parsed.unusedExportedTypes.map((e: any) => `${e.file}:${e.name}`));

  const typesFile = path.join(FIXTURE_ROOT, "types.ts");

  // UsedExported is imported from ./index (barrel) in consumer.ts
  assert(
    !unusedExported.has(`${typesFile}:UsedExported`),
    "UsedExported should be used via barrel",
  );
});
