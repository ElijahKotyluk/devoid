import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "unrift";
import { runCLI } from "../helpers/runCLI";

function writeFile(filePath: string, contents: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
}

describe("CLI --cwd", () => {
  it("resolves project root relative to cwd", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devoid-cwd-"));
    const projectDir = path.join(tmpRoot, "project");
    const srcDir = path.join(projectDir, "src");

    writeFile(path.join(srcDir, "a.ts"), `export const foo = 123;\n`);

    const { code, stdout } = runCLI(["--cwd", "project", "src", "--exports"], { cwd: tmpRoot });

    expect(code).toBe(0);
    expect(stdout).toMatch(/Unused Exports/i);
    expect(stdout).toMatch(/\bfoo\b/);

    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("resolves internal mode file path relative to cwd", () => {
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

    expect(code).toBe(0);
    expect(stdout).toMatch(/Internal Usage Analysis/i);
    expect(stdout).toMatch(/\bunusedFn\b/);

    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("errors if directory does not exist", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devoid-cwd-"));

    const { code, stdout } = runCLI(["--cwd", "nope", "src", "--exports"], { cwd: tmpRoot });

    expect(code).toBe(1);
    expect(stdout).toMatch(/--cwd/i);
    expect(stdout).toMatch(/does not exist/i);

    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("errors if path exists but is not a directory", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devoid-cwd-"));
    const filePath = path.join(tmpRoot, "not-a-dir.txt");
    fs.writeFileSync(filePath, "hi", "utf8");

    const { code, stdout } = runCLI(["--cwd", "not-a-dir.txt", "src"], { cwd: tmpRoot });

    expect(code).toBe(1);
    expect(stdout).toMatch(/--cwd/i);
    expect(stdout).toMatch(/not a directory/i);

    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("works without --cwd (baseline behavior unchanged)", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devoid-cwd-"));
    const srcDir = path.join(tmpRoot, "src");

    writeFile(path.join(srcDir, "a.ts"), `export const foo = 123;\n`);

    const { code, stdout } = runCLI(["src", "--exports"], { cwd: tmpRoot });

    expect(code).toBe(0);
    expect(stdout).toMatch(/\bfoo\b/);

    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });
});
