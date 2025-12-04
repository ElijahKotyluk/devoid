/**
 * Internal API surface for the core analysis engine.
 * These exports are intended for programmatic use inside Devoid
 * and controlled external access through the root index.ts.
 */

export { analyzeProject } from "./analyzer";
export { scanExports } from "./exports/scanExports";
export { buildImportGraph } from "./imports/buildImportGraph";
export { analyzeLocalUsage } from "./locals/analyzeLocalUsage";
