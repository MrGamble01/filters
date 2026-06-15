import type { ProcessedRow } from "../types";
import { toCsv } from "./csv";

/** Dashboard "Update Filter Sizes" column order (Section 16). */
export const DASHBOARD_COLUMNS = ["Name", "Size", "Address 1", "Address 2"];

/** Map a processed (already size-expanded) row to a dashboard record. */
export function toDashboardRecord(row: ProcessedRow): Record<string, string> {
  return {
    Name: row.recipient_name,
    Size: row.filter_sizes[0] ?? "",
    "Address 1": row.address1,
    "Address 2": row.address2,
  };
}

export function dashboardCsv(rows: ProcessedRow[]): string {
  return toCsv(DASHBOARD_COLUMNS, rows.map(toDashboardRecord));
}
