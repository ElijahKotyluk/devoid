import { formatDate, type FormatOptions } from "./utils/date";
import type { User } from "./models/user";

export function prettyUser(user: User): string {
  return formatDate(user.createdAt, { style: "short" } satisfies FormatOptions);
}
