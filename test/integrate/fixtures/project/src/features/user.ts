import { add } from "../utils/math";
import { formatUserName } from "../utils/format";

export function getUserLabel(name: string, a: number, b: number): string {
  const total = add(a, b);
  return formatUserName(`${name} (${total})`);
}
