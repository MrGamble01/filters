/**
 * Core domain types for the processing engine.
 * See BUILD_SPEC.md sections 3, 5, 6, 14.
 */

export type PlatformKey =
  | "appfolio"
  | "rentvine"
  | "buildium"
  | "rentmanager"
  | "beagle";

export type OutputType = "shipstation" | "dashboard";

/** Canonical lease statuses, highest rank first (Section 7). */
export type LeaseStatus = "Current" | "Notice" | "Evict" | "Future" | "Past";

/** Standard flag reasons (Section 14). */
export type FlagReason =
  | "missing_size"
  | "ambiguous_size_review"
  | "ambiguous_zip"
  | "past_only_unit"
  | "likely_duplicate_history"
  | "unparseable_name";

export type AddressQuirk = "unit_field_is_address" | null;

/** A company / property-management group (Section 3, seeded from Section 18). */
export interface Company {
  name: string;
  gr_code: string;
  /** Most-common size, used ONLY for opt-in ShipStation auto-fill. */
  default_filter_size?: string | null;
  address_quirk?: AddressQuirk;
  /** Export-name variants that map to this company. */
  aliases?: string[];
}

/**
 * Normalized intermediate row produced by a platform adapter (Section 6).
 * One per source row before status filtering / dedup.
 */
export interface IntermediateRow {
  property_name: string;
  unit: string;
  unit_tags: string;
  street_address1: string;
  tenant_name: string;
  is_primary_tenant: boolean | null;
  tenant_type: string;
  /** Raw or canonical status string; normalized in Section 7. */
  lease_status: string;
  city: string;
  state: string;
  postal_code: string;
  email: string;
  /** Free-form notes (e.g. AppFolio Tenant Notes) — a fallback size source. */
  notes?: string;
  /** Original source row(s) for audit. */
  raw?: Record<string, unknown>;
}

/**
 * One resolved unit after status/dedup/tenant-selection + per-row enrichment,
 * before multi-size expansion (Sections 7–11).
 */
export interface ResolvedUnit {
  unit_key: string;
  recipient_name: string;
  filter_sizes: string[];
  address1: string;
  address2: string;
  city: string;
  state: string;
  postal_code: string;
  email: string;
  flag_reasons: FlagReason[];
  raw?: unknown;
}

/** One output line after multi-size handling (Section 12) / dedup / split. */
export interface ProcessedRow {
  unit_key: string;
  recipient_name: string;
  filter_sizes: string[];
  address1: string;
  address2: string;
  city: string;
  state: string;
  postal_code: string;
  email: string;
  destination: "send" | "flag";
  flag_reasons: FlagReason[];
  raw?: unknown;
}

/** Per-company / global ShipStation column defaults (Section 15). */
export interface ShipStationDefaults {
  order_number: string;
  shipping_service: string;
  height_in: string;
  length_in: string;
  width_in: string;
  weight_oz: string;
  country_code: string;
  /** Append Address 2 to the single Address column (Section 15, open Q1). */
  append_address2: boolean;
}

export const DEFAULT_SHIPSTATION_DEFAULTS: ShipStationDefaults = {
  order_number: "",
  shipping_service: "",
  height_in: "",
  length_in: "",
  width_in: "",
  weight_oz: "",
  country_code: "US",
  append_address2: true,
};

export interface ProcessOptions {
  company: Company;
  platform: PlatformKey;
  outputType: OutputType;
  /** ShipStation only; never honored for dashboard. */
  autoFillSize?: boolean;
  /** Per-company shipment-history recipient names (Section 13). */
  history?: string[];
  /**
   * Learned sizes keyed by makeUnitKey() — previously-confirmed sizes for a
   * specific unit, used to auto-fill ShipStation when an export omits the size.
   */
  sizeMemory?: Record<string, string[]>;
  shipstationDefaults?: Partial<ShipStationDefaults>;
}

export interface ProcessResult {
  send: ProcessedRow[];
  flags: ProcessedRow[];
  sendCsv: string;
  flagsCsv: string;
}
