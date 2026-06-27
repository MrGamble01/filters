import type { FlagReason } from "../types";
import { squish } from "../util";

/**
 * Name normalization (Section 10), reconciled with real output.
 *
 * Parentheticals and quoted segments are KEPT (e.g. "KIMBERLY DORN (COOPERMAN)"
 * appears verbatim in the ShipStation-ready file — they are real name content,
 * not nicknames to strip). We still standardize LLC formatting and fall back to
 * "[Company] Resident" for missing/placeholder names.
 */

const PLACEHOLDER_NAMES = new Set([
  "",
  "n/a",
  "na",
  "none",
  "null",
  "unknown",
  "tenant",
  "resident",
  "current resident",
  "occupant",
  "current occupant",
  "vacant",
]);

const NAME_SUFFIX = /^(jr|sr|ii|iii|iv|v|md|phd|esq|do|dds|cpa)\.?$/i;

export function normalizeName(
  raw: string,
  companyName: string,
): { name: string; flag?: FlagReason } {
  let s = squish(raw);

  if (/\bl\.?\s*l\.?\s*c\b/i.test(s)) {
    // LLC: "Acme Holdings, LLC." -> "Acme Holdings LLC"
    s = squish(s.replace(/,?\s*l\.?\s*l\.?\s*c\.?\.?\s*$/i, " LLC"));
  } else if (s.includes(",")) {
    // "Last, First" -> "First Last" (one comma; keep name suffixes in place).
    const parts = s.split(",");
    if (parts.length === 2) {
      const left = parts[0].trim();
      const right = parts[1].trim();
      if (left && right) {
        s = NAME_SUFFIX.test(right) ? `${left} ${right}` : `${right} ${left}`;
      }
    }
  }

  // Drop trailing commas / periods.
  s = s.replace(/[,.]+$/, "").trim();

  if (PLACEHOLDER_NAMES.has(s.toLowerCase())) {
    return { name: `${squish(companyName)} Resident` };
  }

  return { name: s };
}
