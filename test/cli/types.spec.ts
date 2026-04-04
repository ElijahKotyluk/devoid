import path from "node:path";

import { fixtures } from "../helpers/fixtures";
import { runCLI } from "../helpers/runCLI";
import { describe, expect, it } from "unrift";

const FIXTURE_ROOT = fixtures("cli", "fixtures", "types");

describe("CLI --types", () => {
  it("without --types flag, type results are not included", () => {
    const res = runCLI([FIXTURE_ROOT, "--json"]);
    expect(res.code).toBe(0);

    const parsed = JSON.parse(res.stdout);

    expect("unusedExportedTypes" in parsed).toBe(false);
    expect("unusedLocalTypes" in parsed).toBe(false);
  });

  it("--types reports unused exported and unused local types", () => {
    const res = runCLI([FIXTURE_ROOT, "--types", "--json"]);

    expect(res.code).toBe(0);

    const parsed = JSON.parse(res.stdout);

    expect(Array.isArray(parsed.unusedExportedTypes)).toBe(true);
    expect(Array.isArray(parsed.unusedLocalTypes)).toBe(true);

    const unusedExported = new Set(
      parsed.unusedExportedTypes.map((e: any) => `${e.file}:${e.name}`),
    );
    const unusedLocal = new Set(parsed.unusedLocalTypes.map((e: any) => `${e.file}:${e.name}`));

    const typesFile = path.join(FIXTURE_ROOT, "types.ts");

    expect(unusedExported.has(`${typesFile}:UsedExported`)).toBe(false);
    expect(unusedExported.has(`${typesFile}:UnusedExported`)).toBe(true);

    expect(unusedLocal.has(`${typesFile}:UsedLocal`)).toBe(false);
    expect(unusedLocal.has(`${typesFile}:UnusedLocal`)).toBe(true);
  });

  it("--types respects barrel type re-exports", () => {
    const res = runCLI([FIXTURE_ROOT, "--types", "--json"]);
    expect(res.code).toBe(0);

    const parsed = JSON.parse(res.stdout);

    const unusedExported = new Set(
      parsed.unusedExportedTypes.map((e: any) => `${e.file}:${e.name}`),
    );

    const typesFile = path.join(FIXTURE_ROOT, "types.ts");

    expect(unusedExported.has(`${typesFile}:UsedExported`)).toBe(false);
  });
});
