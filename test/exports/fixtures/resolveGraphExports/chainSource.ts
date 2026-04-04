// Source module that begins the export chain
export function formatDate(date: Date): string {
  return date.toISOString();
}

export const TIMEZONE = "UTC";
