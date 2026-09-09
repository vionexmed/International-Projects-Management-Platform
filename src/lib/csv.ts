/** Serialises rows to CSV, quoting any value that could break the format. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
}

/** UTF-8 BOM so Excel opens accented characters correctly. */
export const CSV_BOM = "﻿";
