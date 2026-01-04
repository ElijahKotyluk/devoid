// src/cli/index.ts

import { analyzeProject } from "../core";
import { log } from "../utils";
import { disableLogPrefix, enableLogPrefix } from "../utils/logger";
import { disableColors, enableColors, isColorSupported } from "./colors";
import { logUnusedExports, logUnusedFiles, logUnusedLocals, logVerbose, summary } from "./format";
import { showHelp } from "./help";
import { parseArgs } from "./parser";

import { statSync } from "node:fs";
import path from "node:path";

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as any)?.code === "string"
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
  const typesMode = args.types === true;

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

  // Run full-project analysis (existing behavior)
  const results: any = analyzeProject(projectRoot, args);

  // Optional: run types analysis ONLY when requested
  if (typesMode) {
    const { walkFiles } = await import("../core/fileSystem/walkFiles");

    const { loadTSConfig } = await import("../core/tsconfig/tsconfigLoader");

    const { buildTypeUsageGraph } = await import("../core/type/buildTypeUsageGraph");

    const ignorePatterns = (args.ignore || []).map(String);
    const files = walkFiles(projectRoot, ignorePatterns);
    const tsConfig = loadTSConfig(projectRoot);

    const typeGraph = buildTypeUsageGraph(files, tsConfig);

    results.unusedExportedTypes = typeGraph.unusedExportedTypes;
    results.unusedLocalTypes = typeGraph.unusedLocalTypes;

    // Attach into verbose graphs too
    if (results.graphs) results.graphs.types = typeGraph;
  }

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

      if (typesMode) {
        const { logUnusedExportedTypes, logUnusedLocalTypes } = await import("./typesFormat.js");

        logUnusedExportedTypes(results.unusedExportedTypes ?? []);
        logUnusedLocalTypes(results.unusedLocalTypes ?? []);
      }

      if (args.verbose) logVerbose(results.graphs);
    }
  }
})().catch((err) => {
  enableLogPrefix();
  log(`\nFatal error: ${err?.message ?? String(err)}`);
  process.exit(1);
});
