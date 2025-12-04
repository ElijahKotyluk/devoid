export function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

const internalTemp = 123; // unused local
