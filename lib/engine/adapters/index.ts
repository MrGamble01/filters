import type { IntermediateRow, PlatformKey } from "../types";
import { squish } from "../util";
import { ADAPTER_CONFIGS } from "./configs";
import type { AdapterConfig, RawRow } from "./types";

export { ADAPTER_CONFIGS };
export type { AdapterConfig, RawRow } from "./types";

/** Find the first non-empty value among candidate header names. */
function findValue(row: RawRow, candidates: string[] | undefined): string {
  if (!candidates || candidates.length === 0) return "";
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const target = squish(cand).toLowerCase();
    const key = keys.find((k) => squish(k).toLowerCase() === target);
    if (key !== undefined && squish(row[key])) return squish(row[key]);
  }
  return "";
}

/** Gather all columns whose header matches the tag pattern into one string. */
function collectTags(row: RawRow, pattern: RegExp | undefined): string {
  if (!pattern) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(row)) {
    if (pattern.test(k) && squish(v)) parts.push(squish(v));
  }
  return parts.join(", ");
}

function parsePrimary(value: string): boolean | null {
  const v = squish(value).toLowerCase();
  if (!v) return null;
  if (["yes", "y", "true", "1", "primary"].includes(v)) return true;
  if (["no", "n", "false", "0"].includes(v)) return false;
  return null;
}

/** Map raw rows for a platform into normalized intermediate rows (Section 6). */
export function applyAdapter(
  config: AdapterConfig,
  rows: RawRow[],
): IntermediateRow[] {
  return rows.map((row) => {
    const tenantName =
      findValue(row, config.columns.tenant_name) ||
      squish(
        `${findValue(row, config.columns.first_name)} ${findValue(
          row,
          config.columns.last_name,
        )}`,
      );

    const unitTags =
      findValue(row, config.columns.unit_tags) ||
      collectTags(row, config.tagPattern);

    return {
      property_name: findValue(row, config.columns.property_name),
      unit: findValue(row, config.columns.unit),
      unit_tags: unitTags,
      street_address1: findValue(row, config.columns.street_address1),
      tenant_name: tenantName,
      is_primary_tenant: parsePrimary(
        findValue(row, config.columns.is_primary_tenant),
      ),
      tenant_type: findValue(row, config.columns.tenant_type),
      lease_status:
        findValue(row, config.columns.lease_status) ||
        config.defaultStatus ||
        "",
      city: findValue(row, config.columns.city),
      state: findValue(row, config.columns.state),
      postal_code: findValue(row, config.columns.postal_code),
      email: findValue(row, config.columns.email),
      raw: row,
    };
  });
}

/** Run the named platform adapter over raw rows. */
export function runAdapter(
  platform: PlatformKey,
  rows: RawRow[],
): IntermediateRow[] {
  const config = ADAPTER_CONFIGS[platform];
  if (!config) throw new Error(`Unknown platform adapter: ${platform}`);
  return applyAdapter(config, rows);
}
