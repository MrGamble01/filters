import type { IntermediateRow, Company, PlatformKey } from "../types";
import { squish, sameText } from "../util";

/**
 * Address handling (Section 9): split a street into Address 1 / Address 2 and
 * honor the "unit field is the mailable address" quirk.
 */

const DESIGNATOR_WORDS =
  "unit|apt|apartment|ste|suite|bldg|building|rm|room|lot|trlr|trailer|fl|floor|no";

/** Match a trailing unit designator inside a single address string. */
const DESIGNATOR_TAIL = new RegExp(
  `\\b(?:(?:${DESIGNATOR_WORDS})\\b\\.?\\s*#?\\s*[A-Za-z0-9-]+|#\\s*[A-Za-z0-9-]+)\\s*$`,
  "i",
);

/** Does a bare value look like a genuine unit designator (vs a nickname)? */
export function isUnitDesignator(value: string): boolean {
  const s = squish(value);
  if (!s) return false;
  if (new RegExp(`^(?:${DESIGNATOR_WORDS})\\b`, "i").test(s)) return true;
  if (/^#\s*[A-Za-z0-9-]+$/.test(s)) return true; // #3, #B
  if (/^[A-Za-z]?\d{1,5}[A-Za-z]?$/.test(s)) return true; // 204, 12B, B2-style numerics
  if (/^[A-Za-z]$/.test(s)) return true; // single letter A
  if (/^[A-Za-z]\d{1,4}$/.test(s)) return true; // B2
  return false; // multi-word / descriptive -> property nickname
}

/** Split a combined street string into { address1, address2 }. */
export function splitAddress(full: string): {
  address1: string;
  address2: string;
} {
  const s = squish(full);
  const m = DESIGNATOR_TAIL.exec(s);
  if (m && m.index > 0) {
    const address1 = s.slice(0, m.index).replace(/[,\s]+$/, "").trim();
    const address2 = squish(s.slice(m.index));
    return { address1, address2 };
  }
  return { address1: s, address2: "" };
}

/**
 * Decide whether the `Unit` column should be treated as the mailable address.
 * True when the company has the quirk, or for AppFolio multi-unit complexes
 * (a property with 2+ distinct units in the job).
 */
export function buildUnitFieldIsAddress(
  rows: IntermediateRow[],
  company: Company,
  platform: PlatformKey,
): (row: IntermediateRow) => boolean {
  if (company.address_quirk === "unit_field_is_address") {
    return () => true;
  }

  if (platform === "appfolio") {
    const unitsByProperty = new Map<string, Set<string>>();
    for (const r of rows) {
      const prop = squish(r.property_name).toLowerCase();
      const unit = squish(r.unit).toLowerCase();
      if (!unit) continue;
      if (!unitsByProperty.has(prop)) unitsByProperty.set(prop, new Set());
      unitsByProperty.get(prop)!.add(unit);
    }
    const multiUnit = new Set<string>();
    for (const [prop, units] of unitsByProperty) {
      if (units.size >= 2) multiUnit.add(prop);
    }
    return (row) => multiUnit.has(squish(row.property_name).toLowerCase());
  }

  return () => false;
}

/** Resolve Address 1 / Address 2 for a single selected row (Section 9). */
export function resolveAddress(
  row: IntermediateRow,
  unitFieldIsAddress: boolean,
): { address1: string; address2: string } {
  if (unitFieldIsAddress) {
    const source = squish(row.unit) || squish(row.street_address1);
    return splitAddress(source);
  }

  const address1 = squish(row.street_address1);
  const unit = squish(row.unit);

  // Unit equals the property name -> single-unit property, no Address 2.
  if (unit && !sameText(unit, row.property_name) && isUnitDesignator(unit)) {
    return { address1, address2: unit };
  }

  // The street itself may carry a trailing designator (e.g. "405 BERMUDA UNIT D").
  const split = splitAddress(address1);
  if (split.address2) return split;

  return { address1, address2: "" };
}
