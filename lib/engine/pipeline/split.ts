import type { ProcessedRow } from "../types";

/**
 * SEND vs FLAGS split (Section 14). Any row carrying a flag reason goes to
 * FLAGS; everything else is SEND-ready.
 */
export function splitSendFlags(rows: ProcessedRow[]): {
  send: ProcessedRow[];
  flags: ProcessedRow[];
} {
  for (const row of rows) {
    row.destination = row.flag_reasons.length > 0 ? "flag" : "send";
  }
  return {
    send: rows.filter((r) => r.destination === "send"),
    flags: rows.filter((r) => r.destination === "flag"),
  };
}
