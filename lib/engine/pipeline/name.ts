import type { FlagReason } from "../types";
import { squish } from "../util";

/** Name normalization (Section 10). */

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

/**
 * Normalize a tenant name:
 * - strip parenthetical aliases and double-quoted nicknames
 * - standardize LLC formatting
 * - fall back to "[Company] Resident" for missing/placeholder names
 */
export function normalizeName(
  raw: string,
  companyName: string,
): { name: string; flag?: FlagReason } {
  let s = raw ?? "";

  // Strip "(Johnny)" and "May" style aliases. Only double quotes (incl. smart
  // quotes) — never apostrophes, which appear in real names like O'Brien.
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/"[^"]*"/g, " ");
  s = s.replace(/[“”][^“”]*[“”]/g, " ");
  s = squish(s);

  // LLC: "Acme Holdings, LLC." -> "Acme Holdings LLC"
  if (/\bl\.?\s*l\.?\s*c\b/i.test(s)) {
    s = squish(s.replace(/,?\s*l\.?\s*l\.?\s*c\.?\.?\s*$/i, " LLC"));
  }

  // Drop trailing commas / periods.
  s = s.replace(/[,.]+$/, "").trim();

  if (PLACEHOLDER_NAMES.has(s.toLowerCase())) {
    return { name: `${squish(companyName)} Resident` };
  }

  return { name: s };
}
