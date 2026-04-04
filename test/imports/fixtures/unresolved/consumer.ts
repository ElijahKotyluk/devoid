import { localFn } from "./local";

// @ts-ignore
import React from "react";
// @ts-ignore
import something from "unknown-module";

import fs from "node:fs";

export function useThings() {
  return {
    local: localFn(),
    external: React ? "react" : "nope",
    fsType: typeof fs,
    unknown: typeof something,
  };
}
