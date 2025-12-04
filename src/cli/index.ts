import { analyzeProject } from "../core";
import { log } from "../utils";
import { disableLogPrefix, enableLogPrefix } from "../utils/logger";
import { disableColors, enableColors, isColorSupported } from "./colors";
import { logUnusedExports, logUnusedFiles, logUnusedLocals, logVerbose, summary } from "./format";
import { showHelp } from "./help";
import { parseArgs } from "./parser";

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const [command, commandTarget] = args._;

  // Internal single-file analysis mode
  if (command === "internal") {
    if (args.help) {
      if (!args.silent) {
        log("Usage: devoid internal <file.ts> [options]");
        log("Run `devoid --help` for full command list.");
      }
      process.exit(0);
    }

    const filePath = commandTarget;
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
  const projectRoot = args._[0];
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
