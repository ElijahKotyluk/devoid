import { spawnSync } from "child_process";
import path from "node:path";

const NODE = process.execPath;
const CLI_ENTRY = path.resolve(__dirname, "../../../bin/devoid.js");

export function runCLI(args: string[], opts?: { cwd?: string }) {
  const result = spawnSync(NODE, [CLI_ENTRY, ...args], {
    cwd: opts?.cwd,
    encoding: "utf8",
  });

  console.log("Result: ", result);

  return {
    code: result.status ?? 1,
    stdout: (result.stdout ?? "") + (result.stderr ?? ""),
  };
}
