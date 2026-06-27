import type {
  IntermediateRow,
  LeaseStatus,
  OutputType,
  FlagReason,
} from "../types";
import { squish } from "../util";

/** Lease-status rank, higher wins (Section 7). Past is non-shippable (0). */
export const STATUS_RANK: Record<LeaseStatus, number> = {
  Current: 4,
  Notice: 3,
  Evict: 2,
  Future: 1,
  Past: 0,
};

/** Synonyms seen across platform exports, mapped to canonical statuses. */
const STATUS_SYNONYMS: Record<string, LeaseStatus> = {
  current: "Current",
  active: "Current",
  renewing: "Current",
  holdover: "Current",
  "month to month": "Current",
  "month-to-month": "Current",
  mtm: "Current",
  "on notice": "Notice",
  notice: "Notice",
  evict: "Evict",
  eviction: "Evict",
  evicting: "Evict",
  future: "Future",
  pending: "Future",
  upcoming: "Future",
  past: "Past",
  former: "Past",
  previous: "Past",
  inactive: "Past",
  "moved out": "Past",
};

/**
 * Normalize a raw status string to a canonical status. Unknown values are
 * treated as Past so they are never silently shipped (routed to review instead).
 */
export function normalizeStatus(raw: string): LeaseStatus {
  const key = squish(raw).toLowerCase();
  if (key in STATUS_SYNONYMS) return STATUS_SYNONYMS[key];
  for (const [syn, status] of Object.entries(STATUS_SYNONYMS)) {
    if (key.includes(syn)) return status;
  }
  return "Past";
}

/** Eligible statuses by output type (Section 7). */
function eligibleStatuses(outputType: OutputType): Set<LeaseStatus> {
  return outputType === "shipstation"
    ? new Set<LeaseStatus>(["Current", "Notice", "Evict", "Future"])
    : new Set<LeaseStatus>(["Current", "Notice", "Evict"]);
}

/** Canonical unit key for dedup: company + property + unit (Section 7). */
export function unitKey(company: string, property: string, unit: string): string {
  return [company, property, unit]
    .map((s) => squish(s).toLowerCase())
    .join("|");
}

export interface SelectedUnit {
  unit_key: string;
  row: IntermediateRow; // chosen tenant row, with canonical unit_tags
  status: LeaseStatus;
}

export interface SelectionResult {
  selected: SelectedUnit[];
  /** Units routed to FLAGS at this stage (ShipStation past-only). */
  flagged: { unit_key: string; row: IntermediateRow; reason: FlagReason }[];
}

/** Pick the best tenant among rows sharing the top status tier (Section 7). */
function chooseTenant(rows: IntermediateRow[]): IntermediateRow {
  let pool = rows;

  const primaries = pool.filter((r) => r.is_primary_tenant === true);
  if (primaries.length > 0) pool = primaries;

  const responsible = pool.filter((r) =>
    /financially responsible/i.test(r.tenant_type ?? ""),
  );
  if (responsible.length > 0) pool = responsible;

  return pool[0];
}

/** Longest unit_tags string across the whole group is the most complete. */
function canonicalTags(rows: IntermediateRow[]): string {
  return rows.reduce(
    (best, r) => ((r.unit_tags ?? "").length > best.length ? r.unit_tags : best),
    "",
  );
}

/**
 * Status filter + unit dedup + tenant selection (Section 7).
 * Collapses AppFolio charge-date triplicates to one row per unit.
 */
export function selectUnits(
  rows: IntermediateRow[],
  opts: { company: string; outputType: OutputType },
): SelectionResult {
  const eligible = eligibleStatuses(opts.outputType);

  const groups = new Map<string, IntermediateRow[]>();
  for (const row of rows) {
    const key = unitKey(opts.company, row.property_name, row.unit);
    const arr = groups.get(key);
    if (arr) arr.push(row);
    else groups.set(key, [row]);
  }

  const selected: SelectedUnit[] = [];
  const flagged: SelectionResult["flagged"] = [];

  for (const [key, group] of groups) {
    const withStatus = group.map((r) => ({
      r,
      status: normalizeStatus(r.lease_status),
    }));

    const eligibleRows = withStatus.filter((x) => eligible.has(x.status));
    const tags = canonicalTags(group);

    if (eligibleRows.length === 0) {
      // ShipStation: a unit with only Past (non-shippable) rows -> FLAGS.
      // Dashboard: Past and Future are excluded entirely (no flag).
      if (opts.outputType === "shipstation") {
        const best = withStatus
          .slice()
          .sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status])[0];
        flagged.push({
          unit_key: key,
          row: { ...best.r, unit_tags: tags },
          reason: "past_only_unit",
        });
      }
      continue;
    }

    const maxRank = Math.max(
      ...eligibleRows.map((x) => STATUS_RANK[x.status]),
    );
    const topTier = eligibleRows.filter(
      (x) => STATUS_RANK[x.status] === maxRank,
    );

    const chosen = chooseTenant(topTier.map((x) => x.r));
    selected.push({
      unit_key: key,
      row: { ...chosen, unit_tags: tags },
      status: topTier.find((x) => x.r === chosen)?.status ?? "Current",
    });
  }

  return { selected, flagged };
}
