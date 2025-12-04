import { ExportInfo } from "../core/exports/scanExports";
import { ImportRecord } from "../core/imports/buildImportGraph";
import { UsageGraph } from "../core/usage/buildUsageGraph";
import { log } from "../utils";
import { colors } from "./colors";

// Styled section heading
export function heading(text: string): string {
  return `\n${colors.cyan}${colors.bold}${text}${colors.reset}\n${"─".repeat(text.length)}`;
}

/**
 * High-level summary of unused items.
 * Shown when running in non-detailed mode.
 */
export function summary(
  unusedExports: UsageGraph["unusedExports"],
  unusedFiles: UsageGraph["unusedFiles"],
  unusedLocals: UsageGraph["unusedIdentifiers"],
): void {
  log(heading("Devoid Analysis Summary"));

  log(`Unused Exports:            ${colors.yellow}${unusedExports.length}${colors.reset}`);
  log(`Unused Files:              ${colors.yellow}${unusedFiles.length}${colors.reset}`);
  log(`Unused Local Identifiers:  ${colors.yellow}${unusedLocals.length}${colors.reset}`);
  log("");

  log(
    `${colors.dim}Tip: use --exports, --files, or --locals to view detailed lists.${colors.reset}`,
  );
  log("");
}

// Print unused exports grouped by file
export function logUnusedExports(unusedExports: UsageGraph["unusedExports"]): void {
  log(heading("Unused Exports"));

  if (unusedExports.length === 0) {
    log(`${colors.dim}No unused exports found!${colors.reset}\n`);
    return;
  }

  const exportsByFile: Record<string, string[]> = {};

  for (const { file, name } of unusedExports) {
    if (!exportsByFile[file]) exportsByFile[file] = [];
    exportsByFile[file].push(name);
  }

  for (const file of Object.keys(exportsByFile)) {
    log(`${colors.bold}${file}${colors.reset}`);
    for (const exportName of exportsByFile[file]) {
      log(`  • ${exportName}`);
    }
    log("");
  }
}

// Print unused files
export function logUnusedFiles(unusedFiles: UsageGraph["unusedFiles"]): void {
  log(heading("Unused Files"));

  if (unusedFiles.length === 0) {
    log(`${colors.dim}No unused files found!${colors.reset}\n`);
    return;
  }

  for (const filePath of unusedFiles) {
    log(`• ${filePath}`);
  }

  log("");
}

// Print unused local identifiers grouped by file
export function logUnusedLocals(unusedLocals: UsageGraph["unusedIdentifiers"]): void {
  log(heading("Unused Local Identifiers"));

  if (unusedLocals.length === 0) {
    log(`${colors.dim}No unused local identifiers found!${colors.reset}\n`);
    return;
  }

  const localsByFile: Record<string, string[]> = {};

  for (const entry of unusedLocals) {
    const [file, identifier] = entry.split(":");
    if (!localsByFile[file]) localsByFile[file] = [];
    localsByFile[file].push(identifier);
  }

  for (const file of Object.keys(localsByFile)) {
    log(`${colors.bold}${file}${colors.reset}`);
    for (const id of localsByFile[file]) {
      log(`  • ${id}`);
    }
    log("");
  }
}

// Dump raw graphs for debugging
export function logVerbose(graphs: {
  imports: Record<string, ImportRecord[]>;
  exports: Record<string, ExportInfo>;
  usage: UsageGraph;
}): void {
  log(heading("Verbose Output"));

  log(`${colors.magenta}Import Graph:${colors.reset}`);
  log(JSON.stringify(graphs.imports, null, 2));
  log("");

  log(`${colors.magenta}Export Graph:${colors.reset}`);
  log(JSON.stringify(graphs.exports, null, 2));
  log("");

  log(`${colors.magenta}Usage Graph:${colors.reset}`);
  log(JSON.stringify(graphs.usage, null, 2));
  log("");
}
