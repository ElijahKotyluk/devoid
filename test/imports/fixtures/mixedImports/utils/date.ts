export interface FormatOptions {
  style: "short" | "long";
}

export function formatDate(date: number, opts: FormatOptions): string {
  return opts.style === "short"
    ? String(date).slice(0, 4)
    : String(date);
}
