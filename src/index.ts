export { analyzeProject } from "./core/analyzer";

// Re-export common result types for convenience
export type { LocalUsageResult } from "./core/locals/analyzeLocalUsage";
export type { TSConfigInfo } from "./core/tsconfig/tsconfigLoader";
export type { UsageGraph } from "./core/usage/buildUsageGraph";
