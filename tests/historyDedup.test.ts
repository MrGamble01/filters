import { describe, it, expect } from "vitest";
import { historyDedup } from "../lib/engine/pipeline/historyDedup";
import type { ProcessedRow } from "../lib/engine/types";

function row(name: string, sizes: string[]): ProcessedRow {
  return {
    unit_key: "k",
    recipient_name: name,
    filter_sizes: sizes,
    address1: "",
    address2: "",
    city: "",
    state: "",
    postal_code: "",
    email: "",
    destination: "send",
    flag_reasons: [],
  };
}

describe("ShipStation history dedup (Section 13)", () => {
  it("single-filter recipient matching history -> likely_duplicate_history", () => {
    const rows = [row("Jane Doe", ["16x20x1"])];
    historyDedup(rows, ["JANE DOE"]);
    expect(rows[0].flag_reasons).toContain("likely_duplicate_history");
  });

  it("multi-filter recipient matching history -> released (no flag)", () => {
    const rows = [row("Jane Doe", ["16x20x1", "20x25x1"])];
    historyDedup(rows, ["Jane Doe"]);
    expect(rows[0].flag_reasons).toEqual([]);
  });

  it("non-matching recipient is untouched", () => {
    const rows = [row("Someone Else", ["16x20x1"])];
    historyDedup(rows, ["Jane Doe"]);
    expect(rows[0].flag_reasons).toEqual([]);
  });
});
