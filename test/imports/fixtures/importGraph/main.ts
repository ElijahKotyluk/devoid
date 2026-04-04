import { formatDate } from "./utils/date";
import * as Utils from "./utils";
import type { User } from "./models/user";

export function describeUser(user: User): string {
  return `${user.name} (${formatDate(user.id)})`;
}
