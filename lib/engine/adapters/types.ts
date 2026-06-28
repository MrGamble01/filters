import type { IntermediateRow, PlatformKey } from "../types";

/** A raw source row: header -> cell value, as parsed from CSV/XLSX. */
export type RawRow = Record<string, string>;

/**
 * Column map for a platform. Each intermediate field lists candidate source
 * header names (case-insensitive, whitespace-insensitive). Adapters are
 * config-driven so new platforms/columns are added without code changes.
 */
export interface AdapterConfig {
  key: PlatformKey;
  name: string;
  columns: {
    property_name?: string[];
    unit?: string[];
    unit_tags?: string[];
    street_address1?: string[];
    tenant_name?: string[];
    first_name?: string[];
    last_name?: string[];
    is_primary_tenant?: string[];
    tenant_type?: string[];
    lease_status?: string[];
    city?: string[];
    state?: string[];
    postal_code?: string[];
    email?: string[];
    notes?: string[];
  };
  /**
   * Headers matching this pattern are gathered (in order) into unit_tags. Used
   * for exports that spread filter sizes across multiple/duplicate columns.
   */
  tagPattern?: RegExp;
  /**
   * For exports with paired size/quantity columns (e.g. Beagle "Filter Size" /
   * "Quantity"), each size is repeated by its paired quantity into unit_tags.
   * Columns are paired positionally in document order.
   */
  sizeColumnPattern?: RegExp;
  quantityColumnPattern?: RegExp;
  /** Default lease status when the export carries none (e.g. Beagle forms). */
  defaultStatus?: string;
}

export type Adapter = (rows: RawRow[]) => IntermediateRow[];
