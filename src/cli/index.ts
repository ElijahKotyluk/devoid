// src/cli/index.ts

import { analyzeProject } from "../core";
import { loadConfig } from "../core/config/loadConfig";
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
    typeof (error as NodeJS.ErrnoException).code === "string"
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

  const cwd = resolveAndValidateCwd(args.cwd as string | undefined);

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
      log("Usage: devoid <path> [options]");
      log("Run `devoid --help` for all options.");
    }
    process.exit(1);
  }

  // Load config file (CLI flags override config values)
  const config = loadConfig(cwd);

  const ignorePatterns = args.ignore
    ? (Array.isArray(args.ignore) ? args.ignore : [args.ignore]).map(String)
    : (config.ignore ?? []);
  const trackAllLocals = args["track-all-locals"] === true || config.trackAllLocals === true;
  const typesMode = args.types === true || config.types === true;
  const failOnUnused = args["fail-on-unused"] === true || config.failOnUnused === true;

  // --explain mode: show why a file/export is used
  if (args.explain && typeof args.explain === "string") {
    const { walkFiles } = await import("../core/fileSystem/walkFiles");
    const { loadTSConfig } = await import("../core/tsconfig/tsconfigLoader");
    const { scanExports } = await import("../core/exports/scanExports");
    const { buildImportGraph } = await import("../core/imports/buildImportGraph");
    const { explainUsage } = await import("../core/explain/explainUsage");

    const files = walkFiles(projectRoot, ignorePatterns);
    const tsConfig = loadTSConfig(projectRoot);
    const exportMap = scanExports(files);
    const importGraph = buildImportGraph(files, tsConfig);

    // Parse target — supports "file:export" or just "file"
    const parts = args.explain.split(":");
    const targetPath = path.resolve(cwd, parts[0]);
    const exportName = parts[1] || undefined;

    const result = explainUsage(targetPath, exportName, exportMap, importGraph);

    if (args.json) {
      log(JSON.stringify(result, null, 2));
    } else if (!silent) {
      const { colors } = await import("./colors.js");
      log(`\n${colors.cyan}${colors.bold}Explain: ${result.target}${exportName ? ":" + exportName : ""}${colors.reset}`);
      log(`Status: ${result.status === "used" ? colors.green + "USED" : colors.yellow + "UNUSED"}${colors.reset}`);

      if (result.importedBy.length > 0) {
        log(`\nImported by:`);
        for (const imp of result.importedBy) {
          log(`  ${imp.file}`);
          log(`    symbols: ${imp.symbols.join(", ")}`);
        }
      } else {
        log(`\nNo imports found for this target.`);
      }

      if (result.reexportChain.length > 0) {
        log(`\nRe-export chain:`);
        log(`  ${result.reexportChain.join(" → ")}`);
      }
      log("");
    }

    process.exit(0);
  }

  // Run full-project analysis
  const results = analyzeProject(projectRoot, {
    ignore: ignorePatterns,
    trackAllLocals,
  });

  // Optional type analysis results
  let unusedExportedTypes: { file: string; name: string }[] = [];
  let unusedLocalTypes: { file: string; name: string }[] = [];

  // Optional: run types analysis ONLY when requested
  if (typesMode) {
    const { walkFiles } = await import("../core/fileSystem/walkFiles");
    const { loadTSConfig } = await import("../core/tsconfig/tsconfigLoader");
    const { buildTypeUsageGraph } = await import("../core/type/buildTypeUsageGraph");

    const files = walkFiles(projectRoot, ignorePatterns);
    const tsConfig = loadTSConfig(projectRoot);
    const typeGraph = buildTypeUsageGraph(files, tsConfig);

    unusedExportedTypes = typeGraph.unusedExportedTypes;
    unusedLocalTypes = typeGraph.unusedLocalTypes;
  }

  // Optional: unused dependency detection
  let unusedDeps: string[] = [];
  if (args.deps) {
    const { walkFiles } = await import("../core/fileSystem/walkFiles");
    const { detectUnusedDeps } = await import("../core/dependencies/detectUnusedDeps");

    const files = walkFiles(projectRoot, ignorePatterns);
    const depsResult = detectUnusedDeps(cwd, files);
    unusedDeps = depsResult.unused;
  }

  // Determine if anything unused was found
  const hasUnused =
    results.unusedExports.length > 0 ||
    results.unusedFiles.length > 0 ||
    results.unusedIdentifiers.length > 0 ||
    unusedExportedTypes.length > 0 ||
    unusedLocalTypes.length > 0 ||
    unusedDeps.length > 0;

  // JSON output
  if (args.json) {
    const jsonOutput: Record<string, unknown> = typesMode
      ? { ...results, unusedExportedTypes, unusedLocalTypes }
      : { ...results };
    if (args.deps) jsonOutput.unusedDependencies = unusedDeps;
    log(JSON.stringify(jsonOutput, null, 2));
    process.exit(failOnUnused && hasUnused ? 1 : 0);
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

        logUnusedExportedTypes(unusedExportedTypes);
        logUnusedLocalTypes(unusedLocalTypes);
      }

      if (args.deps && unusedDeps.length > 0) {
        const { colors } = await import("./colors.js");
        const { heading } = await import("./format.js");
        log(heading("Unused Dependencies"));
        for (const dep of unusedDeps) {
          log(`  ${colors.yellow}${dep}${colors.reset}`);
        }
        log("");
      } else if (args.deps) {
        const { colors } = await import("./colors.js");
        const { heading } = await import("./format.js");
        log(heading("Unused Dependencies"));
        log(`  ${colors.dim}No unused dependencies found!${colors.reset}\n`);
      }

      if (args.verbose) logVerbose(results.graphs);
    }
  }

  // CI mode: exit non-zero if unused items found
  if (failOnUnused && hasUnused) {
    process.exit(1);
  }
})().catch((err) => {
  enableLogPrefix();
  log(`\nFatal error: ${err?.message ?? String(err)}`);
  process.exit(1);
});
