export function formatUserName(name: string): string {
  return name.trim();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
