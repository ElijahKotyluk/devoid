import path from "node:path";

const TEST_DIR = path.join(process.cwd(), "test");

export function fixtures(...segments: string[]): string {
  return path.join(TEST_DIR, ...segments);
}
