import type {
  Company,
  ProcessedRow,
  ShipStationDefaults,
} from "../types";
import { squish } from "../util";
import { toCsv } from "./csv";

/** ShipStation canonical column order (Section 15). */
export const SHIPSTATION_COLUMNS = [
  "Order #",
  "Shipping Service",
  "Height(in)",
  "Length(in)",
  "Width(in)",
  "Weight(oz)",
  "Custom Field 1",
  "Custom Field 2",
  "Custom Field 3",
  "Recipient Name",
  "Address",
  "City",
  "State",
  "Postal Code",
  "Country Code",
  "Tenant Email",
];

function composeAddress(
  row: ProcessedRow,
  appendAddress2: boolean,
): string {
  const a1 = squish(row.address1);
  const a2 = squish(row.address2);
  if (appendAddress2 && a2) return `${a1} ${a2}`.trim();
  return a1;
}

/** Map a processed row to a ShipStation output record (Section 15). */
export function toShipStationRecord(
  row: ProcessedRow,
  company: Company,
  defaults: ShipStationDefaults,
): Record<string, string> {
  return {
    "Order #": defaults.order_number,
    "Shipping Service": defaults.shipping_service,
    "Height(in)": defaults.height_in,
    "Length(in)": defaults.length_in,
    "Width(in)": defaults.width_in,
    "Weight(oz)": defaults.weight_oz,
    "Custom Field 1": row.filter_sizes.join(", "),
    "Custom Field 2": company.name,
    "Custom Field 3": company.gr_code,
    "Recipient Name": row.recipient_name,
    Address: composeAddress(row, defaults.append_address2),
    City: row.city,
    State: row.state,
    "Postal Code": row.postal_code,
    "Country Code": defaults.country_code,
    "Tenant Email": row.email,
  };
}

export function shipStationCsv(
  rows: ProcessedRow[],
  company: Company,
  defaults: ShipStationDefaults,
): string {
  return toCsv(
    SHIPSTATION_COLUMNS,
    rows.map((r) => toShipStationRecord(r, company, defaults)),
  );
}
