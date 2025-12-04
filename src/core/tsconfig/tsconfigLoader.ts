/**
 * Loads the project's tsconfig.json and extracts only the fields needed
 * for import resolution:
 *   • compilerOptions.baseUrl
 *   • compilerOptions.paths
 *
 * All parsing, inheritance, and JSONC handling is delegated to the
 * TypeScript compiler API. No normalization or path resolution is done here.
 */

import path from "path";
import ts from "typescript";

export interface TSConfigInfo {
  baseUrl?: string;
  paths?: Record<string, string[]>;
}

/**
 * Finds the nearest tsconfig.json starting from `root`, parses it
 * using the official TS API, and extracts the minimal options Devoid needs.
 *
 * Returns an empty object if no tsconfig.json exists.
 */
export function loadTSConfig(root: string): TSConfigInfo {
  const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
  if (!configPath) return {};

  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) {
    throw new Error(`Error reading tsconfig.json: ${config.error.messageText}`);
  }

  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));

  const opts = parsed.options;

  return {
    baseUrl: opts.baseUrl,
    paths: opts.paths,
  };
}
