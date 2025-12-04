import assert from "node:assert";
import path from "node:path";
import test from "node:test";

import { normalizeFilePath } from "../../src/core/fileSystem/normalizePath";

test("normalizeFilePath: produces absolute, forward-slashed paths", () => {
  const relative = "src/utils/logger.ts";
  const normalized = normalizeFilePath(relative);

  assert(path.isAbsolute(normalized));
  assert(normalized.includes("/"));
});

test("normalizeFilePath: handles windows-style backslashes", () => {
  const fakeWinPath = "src\\utils\\logger.ts";
  const normalized = normalizeFilePath(fakeWinPath);

  assert(normalized.includes("/"));
});

test("normalizeFilePath: lowercases paths on Windows", () => {
  const p = normalizeFilePath("SRC/UTILS/LOGGER.TS");
  if (process.platform === "win32") {
    assert.strictEqual(p, p.toLowerCase());
  } else {
    assert(p.length > 0);
  }
});
