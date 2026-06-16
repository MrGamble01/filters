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

/** Repeat each paired size by its quantity (positional pairing, doc order). */
function collectQuantifiedTags(
  row: RawRow,
  sizePattern: RegExp,
  quantityPattern: RegExp,
): string {
  const keys = Object.keys(row);
  const sizeKeys = keys.filter((k) => sizePattern.test(k));
  const qtyKeys = keys.filter((k) => quantityPattern.test(k));
  const parts: string[] = [];
  sizeKeys.forEach((sk, i) => {
    const size = squish(row[sk]);
    if (!size) return;
    const qtyRaw = qtyKeys[i] !== undefined ? squish(row[qtyKeys[i]]) : "";
    let qty = parseInt(qtyRaw, 10);
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    qty = Math.min(qty, 24);
    for (let n = 0; n < qty; n++) parts.push(size);
  });
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
      (config.sizeColumnPattern && config.quantityColumnPattern
        ? collectQuantifiedTags(
            row,
            config.sizeColumnPattern,
            config.quantityColumnPattern,
          )
        : "") ||
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
