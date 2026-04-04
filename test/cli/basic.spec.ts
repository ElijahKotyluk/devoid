import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "unrift";

const CLI_PATH = path.resolve(process.cwd(), "bin", "devoid.js");
const PKG_PATH = path.resolve(process.cwd(), "package.json");

function runCLI(args: string[]) {
  const result = spawnSync("node", [CLI_PATH, ...args], {
    encoding: "utf8",
  });

  return {
    code: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

describe("CLI basic", () => {
  it("devoid --version prints package version and exits 0", () => {
    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));
    const { code, stdout } = runCLI(["--version"]);

    expect(code).toBe(0);
    expect(stdout.includes(pkg.version)).toBe(true);
  });

  it("devoid internal --help shows internal usage and exits 0", () => {
    const { code, stdout } = runCLI(["internal", "--help"]);

    expect(code).toBe(0);
    expect(stdout.includes("Usage: devoid internal <file.ts>")).toBe(true);
  });

  it("devoid without a path but with flags errors and exits 1", () => {
    const { code, stdout } = runCLI(["--exports"]);

    expect(code).toBe(1);
    expect(stdout.includes("No project path provided.")).toBe(true);
  });
});
