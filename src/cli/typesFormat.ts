// src/cli/typesFormat.ts

import { log } from "../utils";
import { colors } from "./colors";
import { heading } from "./format";

export function logUnusedExportedTypes(unused: { file: string; name: string }[]): void {
  log(heading("Unused Exported Types"));

  if (unused.length === 0) {
    log(`${colors.dim}No unused exported types found!${colors.reset}\n`);
    return;
  }

  const byFile: Record<string, string[]> = {};

  for (const { file, name } of unused) {
    if (!byFile[file]) byFile[file] = [];

    byFile[file].push(name);
  }

  for (const file of Object.keys(byFile)) {
    log(`${colors.bold}${file}${colors.reset}`);

    for (const name of byFile[file]) log(`  • ${name}`);

    log("");
  }
}

export function logUnusedLocalTypes(unused: { file: string; name: string }[]): void {
  log(heading("Unused Local Types"));

  if (unused.length === 0) {
    log(`${colors.dim}No unused local types found!${colors.reset}\n`);

    return;
  }

  const byFile: Record<string, string[]> = {};

  for (const { file, name } of unused) {
    if (!byFile[file]) byFile[file] = [];

    byFile[file].push(name);
  }

  for (const file of Object.keys(byFile)) {
    log(`${colors.bold}${file}${colors.reset}`);

    for (const name of byFile[file]) log(`  • ${name}`);

    log("");
  }
}
