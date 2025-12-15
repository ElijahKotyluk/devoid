// tests/cli.basic.test.ts

import assert from "assert/strict";
import { spawnSync } from "child_process";
import fs from "fs";
import { test } from "node:test";
import { resolve } from "path";

const CLI_PATH = resolve("bin", "devoid.js");
const PKG_PATH = resolve("package.json");

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

test("devoid --version prints package version and exits 0", () => {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));
  const { code, stdout } = runCLI(["--version"]);

  assert.equal(code, 0);
  assert.ok(stdout.includes(pkg.version));
});

test("devoid internal --help shows internal usage and exits 0", () => {
  const { code, stdout } = runCLI(["internal", "--help"]);

  assert.equal(code, 0);
  assert.ok(
    stdout.includes("Usage: devoid internal <file.ts>"),
    "internal help should mention 'Usage: devoid internal <file.ts>'",
  );
});

test("devoid without a path but with flags errors and exits 1", () => {
  const { code, stdout } = runCLI(["--exports"]);

  assert.equal(code, 1);
  assert.ok(
    stdout.includes("No project path provided."),
    "should tell the user that no project path was provided",
  );
});
