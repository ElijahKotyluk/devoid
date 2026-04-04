export { analyzeProject } from "./core/analyzer";
export type { AnalyzeOptions } from "./core/analyzer";
export type { DevoidConfig } from "./core/config/loadConfig";
export { loadConfig } from "./core/config/loadConfig";

// Re-export common result types for convenience
export type { LocalUsageResult } from "./core/locals/analyzeLocalUsage";
export type { TSConfigInfo } from "./core/tsconfig/tsconfigLoader";
export type { UsageGraph } from "./core/usage/buildUsageGraph";
