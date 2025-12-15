import { log } from "../utils";
import { colors } from "./colors";

// Prints the CLI help text.
export function showHelp() {
  log(`
${colors.cyan}${colors.bold}Devoid — Dead Code Analyzer for JavaScript/TypeScript${colors.reset}

${colors.bold}Usage:${colors.reset}
  devoid <path> [options]
  devoid internal <file> [options]

${colors.bold}Commands:${colors.reset}
  internal <file>         Run intra-file identifier analysis only.

${colors.bold}General Options:${colors.reset}
  --cwd <path>            Set the current working directory for analysis (default: process.cwd())
  --help                  Show this help message
  --json                  Machine-readable output
  --silent                Suppress all non-JSON output
  --summary-only          Show only summary counts

${colors.bold}Analysis Options:${colors.reset}
  --exports               List unused exports
  --files                 List unused files
  --locals, --identifiers List unused local identifiers
  --track-all-locals      Count all variable declarations (strict mode)

${colors.bold}Output Options:${colors.reset}
  --verbose               Print full graphs (imports, exports, usage)
  --ignore <pattern>      Ignore paths containing this substring
  --color                 Force-enable colored output
  --no-color              Disable colors

${colors.bold}Examples:${colors.reset}
  devoid src/
  devoid src/ --json
  devoid src/ --exports
  devoid src/ --files --locals
  devoid src/ --track-all-locals
  devoid internal src/utils/helpers.ts
  devoid internal src/module.ts --track-all-locals
`);
}
