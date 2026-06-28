import { describe, it, expect } from "vitest";
import { extractSizesFromNotes } from "../lib/engine/pipeline/notes";
import { makeUnitKey } from "../lib/engine/util";
import { processIntermediate } from "../lib/engine/process";
import type { Company, IntermediateRow } from "../lib/engine/types";

const CO: Company = { name: "Test Co", gr_code: "GR1" };

function row(overrides: Partial<IntermediateRow>): IntermediateRow {
  return {
    property_name: "P",
    unit: "",
    unit_tags: "",
    street_address1: "100 Oak St",
    tenant_name: "Jane Doe",
    is_primary_tenant: true,
    tenant_type: "Financially Responsible",
    lease_status: "Current",
    city: "Austin",
    state: "TX",
    postal_code: "78701",
    email: "",
    ...overrides,
  };
}

describe("notes-based size recovery", () => {
  it("pulls a size that appears right after 'filter'", () => {
    expect(
      extractSizesFromNotes("04/20/2026, Filter size 14x30x1; lease note").sizes,
    ).toEqual(["14x30x1"]);
  });

  it("ignores unrelated numbers (dates, money, phones)", () => {
    const notes =
      "10/20/2025 paid $1,000 on 2/9, call (708) 882-3310, plan 12 months";
    expect(extractSizesFromNotes(notes).sizes).toEqual([]);
  });

  it("accepts a 2D size near 'filter' with default depth", () => {
    expect(extractSizesFromNotes("HVAC filter 16x20 please").sizes).toEqual([
      "16x20x1",
    ]);
  });
});

describe("size resolution: tags -> notes -> memory", () => {
  it("uses Tenant Notes when the unit has no tag size (both outputs)", () => {
    const rows = [row({ unit_tags: "", notes: "filter size 14x30x1" })];
    const ship = processIntermediate(rows, {
      company: CO,
      platform: "appfolio",
      outputType: "shipstation",
    });
    expect(ship.send[0].filter_sizes).toEqual(["14x30x1"]);
  });

  it("auto-fills ShipStation from learned memory; dashboard stays flagged", () => {
    const memKey = makeUnitKey("GR1", "100 Oak St", "", "Austin", "TX");
    const sizeMemory = { [memKey]: ["16x20x1"] };

    const ship = processIntermediate([row({ unit_tags: "" })], {
      company: CO,
      platform: "appfolio",
      outputType: "shipstation",
      sizeMemory,
    });
    expect(ship.send).toHaveLength(1);
    expect(ship.send[0].filter_sizes).toEqual(["16x20x1"]);

    const dash = processIntermediate([row({ unit_tags: "" })], {
      company: CO,
      platform: "appfolio",
      outputType: "dashboard",
      sizeMemory,
    });
    expect(dash.flags[0].flag_reasons).toContain("missing_size");
  });

  it("prefers a real tag size over memory", () => {
    const memKey = makeUnitKey("GR1", "100 Oak St", "", "Austin", "TX");
    const r = processIntermediate([row({ unit_tags: "20x25x1" })], {
      company: CO,
      platform: "appfolio",
      outputType: "shipstation",
      sizeMemory: { [memKey]: ["16x20x1"] },
    });
    expect(r.send[0].filter_sizes).toEqual(["20x25x1"]);
  });
});
