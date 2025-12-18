import assert from "assert/strict";
import fs from "fs";
import test from "node:test";
import os from "os";
import path from "path";

import { detectEntryPoints } from "../../src/core/entrypoints/detectEntryPoints";
import { normalizeFilePath } from "../../src/core/fileSystem/normalizePath";

function writeFile(filePath: string, contents: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
}

test("entrypoints: package.json exports (string) maps dist -> src", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devoid-entrypoints-"));

  writeFile(
    path.join(tmpRoot, "package.json"),
    JSON.stringify({ exports: "./dist/index.js" }, null, 2),
  );
  writeFile(path.join(tmpRoot, "src", "index.ts"), `export const foo = 1;\n`);

  const projectFiles = [normalizeFilePath(path.join(tmpRoot, "src", "index.ts"))];

  const info = detectEntryPoints(tmpRoot, projectFiles);
  assert.ok(info.fromPackageJson.has(normalizeFilePath(path.join(tmpRoot, "src", "index.ts"))));

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test("entrypoints: package.json exports (conditional object) maps dist -> src", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devoid-entrypoints-"));

  writeFile(
    path.join(tmpRoot, "package.json"),
    JSON.stringify(
      {
        exports: {
          ".": {
            types: "./dist/index.d.ts",
            require: "./dist/index.cjs",
            import: "./dist/index.js",
            default: "./dist/index.js",
          },
        },
      },
      null,
      2,
    ),
  );
  writeFile(path.join(tmpRoot, "src", "index.ts"), `export const foo = 1;\n`);

  const projectFiles = [normalizeFilePath(path.join(tmpRoot, "src", "index.ts"))];

  const info = detectEntryPoints(tmpRoot, projectFiles);
  assert.ok(info.fromPackageJson.has(normalizeFilePath(path.join(tmpRoot, "src", "index.ts"))));

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test("entrypoints: package.json exports (array) finds string targets", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devoid-entrypoints-"));

  writeFile(
    path.join(tmpRoot, "package.json"),
    JSON.stringify(
      {
        exports: {
          ".": ["./dist/index.js", "./dist/fallback.js"],
        },
      },
      null,
      2,
    ),
  );

  writeFile(path.join(tmpRoot, "src", "index.ts"), `export const foo = 1;\n`);

  const projectFiles = [normalizeFilePath(path.join(tmpRoot, "src", "index.ts"))];

  const info = detectEntryPoints(tmpRoot, projectFiles);
  assert.ok(info.fromPackageJson.has(normalizeFilePath(path.join(tmpRoot, "src", "index.ts"))));

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
