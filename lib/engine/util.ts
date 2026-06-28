import type { FlagReason } from "./types";

/** Collapse whitespace and trim. */
export function squish(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** Case-insensitive, whitespace-normalized text equality. */
export function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return squish(a).toLowerCase() === squish(b).toLowerCase();
}

/** Normalize a name for matching (uppercase, collapse spaces). */
export function normNameKey(s: string | null | undefined): string {
  return squish(s).toUpperCase();
}

/** Normalize a ZIP: trim, drop a trailing ".0" from numeric exports. */
export function normZip(s: string | null | undefined): string {
  let z = squish(s);
  if (z.endsWith(".0")) z = z.slice(0, -2);
  return z;
}

/** city|state key for ZIP backfill. */
export function cityStateKey(city: string, state: string): string {
  return `${squish(city).toLowerCase()}|${squish(state).toLowerCase()}`;
}

/**
 * Stable key identifying a physical mailing destination, used for size-memory
 * (a unit's filter size is stable across monthly exports).
 */
export function makeUnitKey(
  grCode: string,
  address1: string,
  address2: string,
  city: string,
  state: string,
): string {
  return [grCode, address1, address2, city, state]
    .map((s) => squish(s).toLowerCase())
    .join("|");
}

/** Push a flag reason if not already present. */
export function addFlag(target: { flag_reasons: FlagReason[] }, reason: FlagReason): void {
  if (!target.flag_reasons.includes(reason)) target.flag_reasons.push(reason);
}

/** Add a value to an array only if not already present (preserves order). */
export function pushUnique<T>(arr: T[], value: T): void {
  if (!arr.includes(value)) arr.push(value);
}
