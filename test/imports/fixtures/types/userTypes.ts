export interface UserProfile {
  id: string;
  name: string;
}

export type UserId = string;

export function runtimeHelper() {
  // This is a real runtime export, but we'll only import types to
  // ensure it does *not* get marked as used.
  return "ok";
}
