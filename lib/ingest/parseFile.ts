import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { RawRow } from "../engine/adapters";

/**
 * File ingestion: CSV (papaparse) and XLSX (SheetJS) into RawRow[].
 *
 * Parsed as a matrix first so duplicate headers (e.g. Beagle's repeated
 * "Filter Size" / "Quantity" columns) are preserved by suffixing rather than
 * collapsed, which the adapters rely on for positional pairing.
 */

function matrixToRecords(matrix: unknown[][]): RawRow[] {
  if (matrix.length === 0) return [];
  const rawHeaders = (matrix[0] ?? []).map((h) => String(h ?? "").trim());

  const counts: Record<string, number> = {};
  const headers = rawHeaders.map((h) => {
    if (counts[h] === undefined) {
      counts[h] = 0;
      return h;
    }
    counts[h] += 1;
    return `${h}_${counts[h]}`;
  });

  const records: RawRow[] = [];
  for (const row of matrix.slice(1)) {
    if (!row || !row.some((c) => String(c ?? "").trim() !== "")) continue;
    const rec: RawRow = {};
    headers.forEach((key, i) => {
      if (key) rec[key] = String(row[i] ?? "");
    });
    records.push(rec);
  }
  return records;
}

export function parseCsv(text: string): RawRow[] {
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });
  return matrixToRecords(result.data as unknown[][]);
}

export function parseXlsx(buffer: ArrayBuffer): RawRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });
  return matrixToRecords(matrix);
}

/** Dispatch by file extension. */
export async function parseUpload(file: File): Promise<RawRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parseXlsx(await file.arrayBuffer());
  }
  return parseCsv(await file.text());
}
