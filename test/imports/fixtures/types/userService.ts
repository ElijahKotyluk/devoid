import type { UserProfile, UserId } from "./userTypes";

export function getDisplayName(user: UserProfile): string {
  return `${user.name} (${user.id})`;
}

export function isValidUserId(id: UserId): boolean {
  return id.length > 0;
}
