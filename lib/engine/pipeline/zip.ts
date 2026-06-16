import type { ResolvedUnit } from "../types";
import { addFlag, cityStateKey, normZip, squish } from "../util";

/**
 * ZIP backfill (Section 11). Operates over the whole job's resolved units,
 * before multi-size expansion.
 *
 * - missing ZIP + exactly one known ZIP for that city+state -> backfill
 * - missing ZIP + multiple known ZIPs -> leave blank + flag ambiguous_zip
 * - missing ZIP + no known ZIP -> leave blank + flag ambiguous_zip (unresolved)
 */
export function backfillZips(units: ResolvedUnit[]): void {
  const known = new Map<string, Set<string>>();
  for (const u of units) {
    const zip = normZip(u.postal_code);
    if (!zip) continue;
    const key = cityStateKey(u.city, u.state);
    if (!known.has(key)) known.set(key, new Set());
    known.get(key)!.add(zip);
  }

  for (const u of units) {
    if (squish(u.postal_code)) {
      u.postal_code = normZip(u.postal_code);
      continue;
    }
    const zips = known.get(cityStateKey(u.city, u.state));
    if (zips && zips.size === 1) {
      u.postal_code = [...zips][0];
    } else {
      addFlag(u, "ambiguous_zip");
    }
  }
}
