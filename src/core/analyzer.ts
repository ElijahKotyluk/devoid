/**
 * Orchestrates the full project analysis pipeline:
 *   • file discovery
 *   • tsconfig loading
 *   • export scanning
 *   • import graph construction
 *   • entry point detection
 *   • usage analysis
 *
 * This is the main entry point used by the CLI and programmatic API.
 */

import { detectEntryPoints } from "./entrypoints/detectEntryPoints";
import { scanExports } from "./exports/scanExports";
import { walkFiles } from "./fileSystem/walkFiles";
import { buildImportGraph } from "./imports/buildImportGraph";
import { loadTSConfig } from "./tsconfig/tsconfigLoader";
import { buildUsageGraph } from "./usage/buildUsageGraph";

// Cache tsconfig loads per project root
const tsconfigCache = new Map<string, ReturnType<typeof loadTSConfig>>();

export function analyzeProject(root: string, options: any) {
  const ignorePatterns = (options.ignore || []).map(String);
  const trackAllLocals = options.trackAllLocals === true;

  const files = walkFiles(root, ignorePatterns);

  let tsConfig = tsconfigCache.get(root);
  if (!tsConfig) {
    tsConfig = loadTSConfig(root);
    tsconfigCache.set(root, tsConfig);
  }

  const exportMap = scanExports(files);
  const importGraph = buildImportGraph(files, tsConfig);
  const entryPointsInfo = detectEntryPoints(root, files);

  const usageGraph = buildUsageGraph(
    files,
    exportMap,
    importGraph,
    { trackAllLocals },
    entryPointsInfo.all,
  );

  return {
    ...usageGraph,
    graphs: {
      exports: exportMap,
      usage: usageGraph,
      imports: importGraph,
      entryPoints: {
        all: [...entryPointsInfo.all],
        fromPackageJson: [...entryPointsInfo.fromPackageJson],
        fromConventions: [...entryPointsInfo.fromConventions],
      },
    },
  };
}
