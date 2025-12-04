/**
 * Minimal dependency-free CLI argument parser.
 *
 * Produces an object:
 *   {
 *     _: [positional args],
 *     flag: true,
 *     flagName: "value",
 *   }
 *
 * Supported:
 *   --flag
 *   --flag value
 *   -x
 *   positional args
 */
export function parseArgs(argv: string[]) {
  const args: Record<string, any> = { _: [] };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    // Long flags: --foo or --foo value
    if (token.startsWith("--")) {
      const key = token.slice(2);

      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        args[key] = next;
        i++; // consume value
      } else {
        args[key] = true;
      }

      continue;
    }

    // Short flags: -x
    if (token.startsWith("-")) {
      args[token.slice(1)] = true;
      continue;
    }

    // Positional
    args._.push(token);
  }

  return args;
}
