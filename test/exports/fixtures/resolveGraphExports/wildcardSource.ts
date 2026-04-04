// Source module with multiple wildcard exports for chaining
export const API_URL = "/api/v1";
export const DEFAULT_TIMEOUT = 5000;

export function request(endpoint: string) {
  return { ok: true, endpoint };
}
