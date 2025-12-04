import fs from "fs";
import { analyzeLocalUsage } from "../core/locals/analyzeLocalUsage";
import { log } from "../utils";
import { colors } from "./colors";
import { heading } from "./format";

/**
 * Run isolated intra-file usage analysis:
 *   devoid internal <file.ts> [flags]
 *
 * Bypasses project-wide analysis and reports:
 *   • declared identifiers
 *   • referenced identifiers
 *   • unused identifiers
 */
export async function runInternalMode(filePath: string, args: any): Promise<void> {
  const SILENT_MODE = !!args.silent;
  let sourceText: string;

  // Read file
  try {
    sourceText = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (!SILENT_MODE) {
      log(`${colors.red}Error: Unable to read file: ${filePath}${colors.reset}`);
      if (error instanceof Error) {
        log(`${colors.red}(Details: ${error.message})${colors.reset}`);
      }
    }
    process.exit(1);
  }

  // Run local-only usage analysis
  const result = analyzeLocalUsage(filePath, sourceText, {
    trackAllLocals: args["track-all-locals"] === true,
  });

  // JSON output
  if (args.json) {
    log(JSON.stringify(result, null, 2));
    return;
  }

  if (SILENT_MODE) return;

  log(heading(`Internal Usage Analysis: ${filePath}`));

  // Declared identifiers
  log(`${colors.cyan}Declared Identifiers:${colors.reset}`);
  if (result.declared.length === 0) {
    log(`  ${colors.dim}(none)${colors.reset}`);
  } else {
    for (const name of result.declared) {
      log(`  • ${name}`);
    }
  }
  log("");

  // Referenced identifiers
  log(`${colors.cyan}Referenced Identifiers:${colors.reset}`);
  if (result.referenced.length === 0) {
    log(`  ${colors.dim}(none)${colors.reset}`);
  } else {
    for (const name of result.referenced) {
      log(`  • ${name}`);
    }
  }
  log("");

  // Unused identifiers
  log(`${colors.cyan}Unused Identifiers:${colors.reset}`);
  if (result.unused.length === 0) {
    log(`  ${colors.green}(none)${colors.reset}`);
  } else {
    for (const name of result.unused) {
      log(`  • ${colors.yellow}${name}${colors.reset}`);
    }
  }

  log("");
  log(
    `${colors.dim}Tip: use --track-all-locals to detect variables with type annotations.${colors.reset}`,
  );
}
