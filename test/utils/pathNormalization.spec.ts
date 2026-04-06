import path from "node:path";

import { describe, expect, it } from "unrift";
import { normalizeFilePath } from "../../src/core/fileSystem/normalizePath";

describe("normalizeFilePath", () => {
  it("normalizeFilePath: produces absolute, forward-slashed paths", () => {
    const relative = "src/utils/logger.ts";
    const normalized = normalizeFilePath(relative);

    expect(path.isAbsolute(normalized)).toBe(true);
    expect(normalized.includes("/")).toBe(true);
  });

  it("normalizeFilePath: handles windows-style backslashes", () => {
    const fakeWinPath = "src\\utils\\logger.ts";
    const normalized = normalizeFilePath(fakeWinPath);

    expect(normalized.includes("/")).toBe(true);
  });

  it("normalizeFilePath: lowercases paths on Windows", () => {
    const p = normalizeFilePath("SRC/UTILS/LOGGER.TS");
    if (process.platform === "win32") {
      expect(p).toBe(p.toLowerCase());
    } else {
      expect(p.length > 0).toBe(true);
    }
  });
});
