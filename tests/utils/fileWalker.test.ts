import assert from "assert";
import path from "node:path";
import test from "node:test";

import { walkFiles } from "../../src/core/fileSystem/walkFiles";

const fixturesRoot = path.join(__dirname, "fixtures", "walkFiles");

test("walkFiles: collects ts/tsx/js/jsx files and respects ignore patterns", () => {
  const root = path.join(fixturesRoot, "src");

  const allFiles = walkFiles(root);
  const ignoredFiles = walkFiles(root, ["ignore"]);

  assert(allFiles.some((f) => f.endsWith("index.ts")));
  assert(allFiles.some((f) => f.endsWith("App.tsx")));
  assert(allFiles.some((f) => f.endsWith("random.ts")));
  assert(allFiles.some((f) => f.endsWith("component.jsx")));

  assert(!ignoredFiles.some((f) => f.includes("ignore.me")));
});
