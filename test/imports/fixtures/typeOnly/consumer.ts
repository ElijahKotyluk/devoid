import type { User } from "./models/user";

export function debugUser(user: User): string {
  return `${user.id}:${user.name}`;
}
