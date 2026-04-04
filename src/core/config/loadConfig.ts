import fs from "node:fs";
import path from "node:path";

export interface DevoidConfig {
  ignore?: string[];
  entry?: string[];
  trackAllLocals?: boolean;
  types?: boolean;
  failOnUnused?: boolean;
}

const CONFIG_FILENAMES = ["devoid.config.json", ".devoidrc", ".devoidrc.json"];

/**
 * Load a devoid config file from the project root.
 * Searches for devoid.config.json, .devoidrc, or .devoidrc.json.
 * Returns an empty config if no file is found.
 */
export function loadConfig(projectRoot: string): DevoidConfig {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = path.join(projectRoot, filename);

    if (!fs.existsSync(configPath)) continue;

    try {
      const raw = fs.readFileSync(configPath, "utf8");
      const parsed = JSON.parse(raw);
      return validateConfig(parsed, configPath);
    } catch {
      // Invalid JSON — skip silently
      continue;
    }
  }

  return {};
}

function validateConfig(raw: unknown, configPath: string): DevoidConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }

  const obj = raw as Record<string, unknown>;
  const config: DevoidConfig = {};

  if (Array.isArray(obj.ignore)) {
    config.ignore = obj.ignore.filter((v): v is string => typeof v === "string");
  }

  if (Array.isArray(obj.entry)) {
    config.entry = obj.entry.filter((v): v is string => typeof v === "string");
  }

  if (typeof obj.trackAllLocals === "boolean") {
    config.trackAllLocals = obj.trackAllLocals;
  }

  if (typeof obj.types === "boolean") {
    config.types = obj.types;
  }

  if (typeof obj.failOnUnused === "boolean") {
    config.failOnUnused = obj.failOnUnused;
  }

  return config;
}
