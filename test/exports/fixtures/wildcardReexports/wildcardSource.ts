export const API_URL = "https://api.example.com";
export const DEFAULT_TIMEOUT = 5000;

export function request(url: string): string {
  return `Request: ${url}`;
}

export default function defaultHandler() {
  return "default-handler";
}
