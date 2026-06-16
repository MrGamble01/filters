import { describe, it, expect } from "vitest";
import { parseCsv } from "../lib/ingest/parseFile";
import { processRaw } from "../lib/engine/process";
import type { Company } from "../lib/engine/types";

const COMPANY: Company = {
  name: "Innovative Realty LLC",
  gr_code: "GR0802",
  default_filter_size: "16x20x1",
};

// Beagle export shape: duplicate "Filter Size" / "Quantity" column pairs.
const BEAGLE_CSV = [
  "First Name,Last Name,Email,Street Address,UNIT,City,State,Zip Code,Filter Size,Quantity,Filter Size,Quantity",
  "Jane,Doe,jane@x.com,405 Bermuda,Unit D,Copperas Cove,TX,76522,16x20x1,2,20x25x1,1",
  "Bob,Stone,,118 Oak St,,Killeen,TX,76542,20x20x1,1,,",
].join("\n");

describe("Beagle ingestion → ShipStation (duplicate headers + quantity)", () => {
  it("preserves duplicate columns and repeats sizes by quantity", () => {
    const rows = parseCsv(BEAGLE_CSV);
    expect(rows).toHaveLength(2);
    // Duplicate headers are suffixed, not collapsed.
    expect(Object.keys(rows[0])).toContain("Filter Size");
    expect(Object.keys(rows[0])).toContain("Filter Size_1");

    const result = processRaw(rows, {
      company: COMPANY,
      platform: "beagle",
      outputType: "shipstation",
    });

    const jane = result.send.find((r) => r.recipient_name === "Jane Doe");
    expect(jane).toBeDefined();
    // qty 2 of 16x20x1 + qty 1 of 20x25x1
    expect(jane!.filter_sizes).toEqual(["16x20x1", "16x20x1", "20x25x1"]);
    expect(jane!.address1).toBe("405 Bermuda");
    expect(jane!.address2).toBe("Unit D");

    // Address 2 appended into the single Address column; CF1 comma-joined.
    expect(result.sendCsv).toContain("16x20x1, 16x20x1, 20x25x1");
    expect(result.sendCsv).toContain("405 Bermuda Unit D");
    expect(result.sendCsv).toContain("GR0802");
  });

  it("dashboard output expands to distinct sizes (no quantity repeats)", () => {
    const rows = parseCsv(BEAGLE_CSV);
    const result = processRaw(rows, {
      company: COMPANY,
      platform: "beagle",
      outputType: "dashboard",
    });
    const jane = result.send.filter((r) => r.recipient_name === "Jane Doe");
    expect(jane.map((r) => r.filter_sizes[0])).toEqual(["16x20x1", "20x25x1"]);
  });
});
