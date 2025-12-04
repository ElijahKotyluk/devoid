// Flag indicating whether color output is enabled.
let COLOR_ENABLED = true;

export function disableColors() {
  COLOR_ENABLED = false;
}

export function enableColors() {
  COLOR_ENABLED = true;
}

/**
 * Detect whether color output should be enabled by default.
 * Used at CLI startup (manual flags override this).
 */
export function isColorSupported(): boolean {
  if (process.env.TERM === "dumb") return false;
  if (process.env.CI) return false;
  if (!process.stdout.isTTY) return false;
  if (process.env.NO_COLOR !== undefined) return false;
  return true;
}

// ANSI escape sequences that respect COLOR_ENABLED.
export const colors = {
  get reset() {
    return COLOR_ENABLED ? "\x1b[0m" : "";
  },
  get dim() {
    return COLOR_ENABLED ? "\x1b[2m" : "";
  },
  get bold() {
    return COLOR_ENABLED ? "\x1b[1m" : "";
  },
  get cyan() {
    return COLOR_ENABLED ? "\x1b[36m" : "";
  },
  get yellow() {
    return COLOR_ENABLED ? "\x1b[33m" : "";
  },
  get magenta() {
    return COLOR_ENABLED ? "\x1b[35m" : "";
  },
  get red() {
    return COLOR_ENABLED ? "\x1b[31m" : "";
  },
  get green() {
    return COLOR_ENABLED ? "\x1b[32m" : "";
  },
};
