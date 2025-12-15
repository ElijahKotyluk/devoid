import { analyzeProject } from "../core";
import { log } from "../utils";
import { disableLogPrefix, enableLogPrefix } from "../utils/logger";
import { disableColors, enableColors, isColorSupported } from "./colors";
import { logUnusedExports, logUnusedFiles, logUnusedLocals, logVerbose, summary } from "./format";
import { showHelp } from "./help";
import { parseArgs } from "./parser";

import { statSync } from "fs";
import path from "path";

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error?.code === "string"
  );
}

function resolveAndValidateCwd(rawCwd?: string): string {
  const resolvedCwd = rawCwd ? path.resolve(process.cwd(), rawCwd) : process.cwd();

  if (!rawCwd) return resolvedCwd;

  let stat;

  try {
    stat = statSync(resolvedCwd);

    if (!stat.isDirectory()) {
      log(`Error: --cwd is not a directory: ${resolvedCwd}`);
      process.exit(1);
    }
  } catch (error) {
    if (isNodeError(error)) {
      switch (error.code) {
        case "ENOENT":
          log(`Error: --cwd path does not exist:\n  ${resolvedCwd}`);
          break;

        case "ENOTDIR":
          log(`Error: --cwd contains a non-directory segment:\n  ${resolvedCwd}`);
          break;

        case "EACCES":
        case "EPERM":
          log(`Error: Permission denied accessing --cwd:\n  ${resolvedCwd}`);
          break;

        default:
          log(`Error: Unable to access --cwd:\n  ${resolvedCwd}`);
      }
    } else {
      log(`Error: Unable to access --cwd:\n  ${resolvedCwd}`);
    }

    process.exit(1);
  }

  return resolvedCwd;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const [command, targetPath] = args._;

  const cwd = resolveAndValidateCwd(args.cwd);

  // Internal single-file analysis mode
  if (command === "internal") {
    if (args.help) {
      if (!args.silent) {
        log("Usage: devoid internal <file.ts> [options]");
        log("Run `devoid --help` for global options.");
      }
      process.exit(0);
    }

    const filePath = targetPath ? path.resolve(cwd, targetPath) : null;

    if (!filePath) {
      if (!args.silent) {
        log("Error: No file provided for internal analysis.");
        log("Usage: devoid internal <file.ts>");
      }
      process.exit(1);
    }

    disableLogPrefix();

    const { runInternalMode } = await import("./internalMode.js");
    await runInternalMode(filePath, args);
    process.exit(0);
  }

  // Output formatting flags
  if (args["no-color"]) disableColors();
  if (args["color"] && isColorSupported()) enableColors();

  if (args.verbose) enableLogPrefix();
  else disableLogPrefix();

  const silent = args.silent === true;
  const summaryOnly = args["summary-only"] === true;

  // --version
  if (args.version) {
    if (!silent) {
      const pkg = require("../../package.json");
      log(pkg.version);
    }
    process.exit(0);
  }

  // --help
  if (args.help) {
    if (!silent) showHelp();
    process.exit(0);
  }

  // Project root path
  const projectRoot = args._[0] ? path.resolve(cwd, args._[0]) : null;

  if (!projectRoot) {
    if (!silent) {
      log("Error: No project path provided.");
      log("Run `devoid --help` for usage.");
    }
    process.exit(1);
  }

  // Run full-project analysis
  const results = analyzeProject(projectRoot, args);

  // JSON output
  if (args.json) {
    log(JSON.stringify(results, null, 2));
    process.exit(0);
  }

  // Human-readable output
  if (!silent) {
    summary(results.unusedExports, results.unusedFiles, results.unusedIdentifiers);

    if (!summaryOnly) {
      if (args.exports) logUnusedExports(results.unusedExports);
      if (args.files) logUnusedFiles(results.unusedFiles);
      if (args.locals || args.identifiers) logUnusedLocals(results.unusedIdentifiers);
      if (args.verbose) logVerbose(results.graphs);
    }
  }
})().catch((err) => {
  enableLogPrefix();
  log(`\nFatal error: ${err?.message ?? String(err)}`);
  process.exit(1);
});
