import type {
  Company,
  OutputType,
  ProcessedRow,
  ShipStationDefaults,
} from "../types";
import { DEFAULT_SHIPSTATION_DEFAULTS } from "../types";
import {
  SHIPSTATION_COLUMNS,
  shipStationCsv,
  toShipStationRecord,
} from "./shipstation";
import { DASHBOARD_COLUMNS, dashboardCsv, toDashboardRecord } from "./dashboard";
import { toCsv } from "./csv";

export const FLAG_REASON_COLUMN = "Flag Reasons";

/** Render SEND and FLAGS CSVs for an output type (reused on inline edits). */
export function renderCsvs(opts: {
  outputType: OutputType;
  send: ProcessedRow[];
  flags: ProcessedRow[];
  company: Company;
  defaults?: Partial<ShipStationDefaults>;
}): { sendCsv: string; flagsCsv: string } {
  const defaults: ShipStationDefaults = {
    ...DEFAULT_SHIPSTATION_DEFAULTS,
    ...(opts.defaults ?? {}),
  };

  if (opts.outputType === "shipstation") {
    return {
      sendCsv: shipStationCsv(opts.send, opts.company, defaults),
      flagsCsv: toCsv(
        [...SHIPSTATION_COLUMNS, FLAG_REASON_COLUMN],
        opts.flags.map((r) => ({
          ...toShipStationRecord(r, opts.company, defaults),
          [FLAG_REASON_COLUMN]: r.flag_reasons.join(", "),
        })),
      ),
    };
  }

  return {
    sendCsv: dashboardCsv(opts.send),
    flagsCsv: toCsv(
      [...DASHBOARD_COLUMNS, FLAG_REASON_COLUMN],
      opts.flags.map((r) => ({
        ...toDashboardRecord(r),
        [FLAG_REASON_COLUMN]: r.flag_reasons.join(", "),
      })),
    ),
  };
}
