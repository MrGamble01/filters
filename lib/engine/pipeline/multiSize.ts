import type { OutputType, ProcessedRow, ResolvedUnit } from "../types";

/**
 * Multi-size handling (Section 12).
 * - ShipStation: one row per recipient, all sizes consolidated (Custom Field 1).
 * - Dashboard: expand to one row per distinct size.
 */
export function applyMultiSize(
  units: ResolvedUnit[],
  outputType: OutputType,
): ProcessedRow[] {
  const rows: ProcessedRow[] = [];

  for (const u of units) {
    const base = {
      unit_key: u.unit_key,
      recipient_name: u.recipient_name,
      address1: u.address1,
      address2: u.address2,
      city: u.city,
      state: u.state,
      postal_code: u.postal_code,
      email: u.email,
      destination: "send" as const,
      raw: u.raw,
    };

    if (outputType === "dashboard" && u.filter_sizes.length > 0) {
      for (const size of u.filter_sizes) {
        rows.push({
          ...base,
          filter_sizes: [size],
          flag_reasons: [...u.flag_reasons],
        });
      }
    } else {
      // ShipStation (always one row) or a flagged unit with no parseable size.
      rows.push({
        ...base,
        filter_sizes: [...u.filter_sizes],
        flag_reasons: [...u.flag_reasons],
      });
    }
  }

  return rows;
}
