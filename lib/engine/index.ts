/** Public surface of the processing engine. */

export * from "./types";
export { processIntermediate, processRaw } from "./process";

export { runAdapter, applyAdapter, ADAPTER_CONFIGS } from "./adapters";
export type { RawRow, AdapterConfig } from "./adapters";

export {
  selectUnits,
  normalizeStatus,
  unitKey,
  STATUS_RANK,
} from "./pipeline/status";
export {
  extractFilterSizes,
  normalizeTriple,
  resolveUnitSizes,
} from "./pipeline/filterSize";
export {
  splitAddress,
  resolveAddress,
  isUnitDesignator,
  buildUnitFieldIsAddress,
} from "./pipeline/address";
export { normalizeName } from "./pipeline/name";
export { backfillZips } from "./pipeline/zip";
export { applyMultiSize } from "./pipeline/multiSize";
export { historyDedup } from "./pipeline/historyDedup";
export { splitSendFlags } from "./pipeline/split";

export {
  SHIPSTATION_COLUMNS,
  shipStationCsv,
  toShipStationRecord,
} from "./output/shipstation";
export {
  DASHBOARD_COLUMNS,
  dashboardCsv,
  toDashboardRecord,
} from "./output/dashboard";
export { toCsv } from "./output/csv";
