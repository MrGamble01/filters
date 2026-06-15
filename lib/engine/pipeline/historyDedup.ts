import type { ProcessedRow } from "../types";
import { addFlag, normNameKey } from "../util";

/**
 * ShipStation dedup against shipment history (Section 13). Name-only match.
 *
 * - single-filter recipient matching history -> flag likely_duplicate_history
 * - multi-filter recipient matching history -> released to ship (legit new order)
 *
 * Skipped entirely for dashboard output.
 */
export function historyDedup(rows: ProcessedRow[], historyNames: string[]): void {
  const history = new Set(historyNames.map((n) => normNameKey(n)));
  if (history.size === 0) return;

  for (const row of rows) {
    if (!history.has(normNameKey(row.recipient_name))) continue;
    if (row.filter_sizes.length <= 1) {
      addFlag(row, "likely_duplicate_history");
    }
    // multi-filter recipients are released to SEND.
  }
}
