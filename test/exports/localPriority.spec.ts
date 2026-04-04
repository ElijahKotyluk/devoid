import fs from "node:fs";
import path from "node:path";

import { resolveExportGraph } from "../../src/core/exports/resolveExportGraph";
import { scanExports } from "../../src/core/exports/scanExports";
import { fixtures } from "../helpers/fixtures";
import { describe, expect, it } from "unrift";

const root = fixtures("exports", "fixtures", "localPriority");

function loadFiles(dir: string): string[] {
  const out: string[] = [];
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    if (filePath.endsWith(".ts")) out.push(filePath);
  }
  return out;
}

describe("local priority", () => {
  it("local declarations override everything", () => {
    const files = loadFiles(root);
    const exportMap = scanExports(files);
    const resolved = resolveExportGraph(exportMap, files);

    const index = path.join(root, "index.ts");
    const entries = resolved[index];

    const localAdd = entries.find((e) => e.name === "add");
    expect(localAdd).toBeDefined();
    expect(localAdd!.sourceFile).toBe(index);
  });
});
