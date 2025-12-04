/* eslint-disable no-console */
let USE_PREFIX = false;
const PREFIX = "[devoid]";

// Enable/disable prefix at runtime (CLI decides)
export function enableLogPrefix() {
  USE_PREFIX = true;
}

export function disableLogPrefix() {
  USE_PREFIX = false;
}

export const log = (...messages: any[]) => {
  if (process.env.NODE_ENV === "test") return;

  if (USE_PREFIX) console.log(`${PREFIX}: `, ...messages);
  else console.log(...messages);
};

export const verboseLog = (verbose: boolean, ...messages: any[]) => {
  if (!verbose || process.env.NODE_ENV === "test") return;

  if (USE_PREFIX) console.log(`${PREFIX}: `, ...messages);
  else console.log(...messages);
};
