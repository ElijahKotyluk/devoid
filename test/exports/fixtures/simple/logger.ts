export default function log(message: string) {
  // noop
}

export function debug(message: string) {
  log(`[debug] ${message}`);
}
