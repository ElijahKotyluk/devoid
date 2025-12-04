export const FEATURE_FLAG = true;

// Re-exporting from a file that does NOT exist.
// This must be ignored by the resolver and must not break anything.

// @ts-ignore
export * from "./doesNotExist";
// @ts-ignore
export { missingSymbol } from "./alsoMissing";
