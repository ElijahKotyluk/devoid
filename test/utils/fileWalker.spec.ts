import path from "node:path";

import { walkFiles } from "../../src/core/fileSystem/walkFiles";
import { fixtures } from "../helpers/fixtures";
import { describe, expect, it } from "unrift";

const fixturesRoot = fixtures("utils", "fixtures", "walkFiles");

describe("walkFiles", () => {
  it("walkFiles: collects ts/tsx/js/jsx files and respects ignore patterns", () => {
    const root = path.join(fixturesRoot, "src");

    const allFiles = walkFiles(root);
    const ignoredFiles = walkFiles(root, ["ignore"]);

    expect(allFiles.find((f) => f.includes("index.ts"))).toBeDefined();
    expect(allFiles.find((f) => f.includes("App.tsx"))).toBeDefined();
    expect(allFiles.find((f) => f.includes("random.ts"))).toBeDefined();
    expect(allFiles.find((f) => f.includes("component.jsx"))).toBeDefined();

    expect(ignoredFiles.find((f) => f.includes("ignore.me"))).toBeUndefined();
  });
});
