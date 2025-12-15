import assert from "assert/strict";
import fs from "fs";
import test from "node:test";
import os from "os";
import path from "path";

import { runCLI } from "./utils/runCLI";

function writeFile(filePath: string, contents: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
}

test("--cwd: resolves project root relative to cwd", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devoid-cwd-"));
  const projectDir = path.join(tmpRoot, "project");
  const srcDir = path.join(projectDir, "src");

  writeFile(path.join(srcDir, "a.ts"), `export const foo = 123;\n`);

  const { code, stdout } = runCLI(["--cwd", "project", "src", "--exports"], { cwd: tmpRoot });

  assert.equal(code, 0);
  assert.match(stdout, /Unused Exports/i);
  assert.match(stdout, /\bfoo\b/);
});

test("--cwd: resolves internal mode file path relative to cwd", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devoid-cwd-"));
  const projectDir = path.join(tmpRoot, "project");
  const srcDir = path.join(projectDir, "src");

  writeFile(
    path.join(srcDir, "internal.ts"),
    `
function unusedFn() {}
function usedFn() {}
usedFn();
`,
  );

  const { code, stdout } = runCLI(["--cwd", "project", "internal", "src/internal.ts"], {
    cwd: tmpRoot,
  });

  assert.equal(code, 0);
  assert.match(stdout, /Internal Usage Analysis/i);
  assert.match(stdout, /\bunusedFn\b/);
});

test("--cwd: errors if directory does not exist", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devoid-cwd-"));

  const { code, stdout } = runCLI(["--cwd", "nope", "src", "--exports"], { cwd: tmpRoot });

  assert.equal(code, 1);
  assert.match(stdout, /--cwd/i);
  assert.match(stdout, /does not exist/i);
});

test("--cwd: errors if path exists but is not a directory", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devoid-cwd-"));
  const filePath = path.join(tmpRoot, "not-a-dir.txt");
  fs.writeFileSync(filePath, "hi", "utf8");

  const { code, stdout } = runCLI(["--cwd", "not-a-dir.txt", "src"], { cwd: tmpRoot });

  assert.equal(code, 1);
  assert.match(stdout, /--cwd/i);
  assert.match(stdout, /not a directory/i);
});

test("--cwd: works without --cwd (baseline behavior unchanged)", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devoid-cwd-"));
  const srcDir = path.join(tmpRoot, "src");

  writeFile(path.join(srcDir, "a.ts"), `export const foo = 123;\n`);

  const { code, stdout } = runCLI(["src", "--exports"], { cwd: tmpRoot });

  assert.equal(code, 0);
  assert.match(stdout, /\bfoo\b/);
});
