import { describe, it, expect } from "vitest";
import { backfillZips } from "../lib/engine/pipeline/zip";
import type { ResolvedUnit } from "../lib/engine/types";

function unit(overrides: Partial<ResolvedUnit>): ResolvedUnit {
  return {
    unit_key: "k",
    recipient_name: "R",
    filter_sizes: ["16x20x1"],
    address1: "1 St",
    address2: "",
    city: "Austin",
    state: "TX",
    postal_code: "",
    email: "",
    flag_reasons: [],
    ...overrides,
  };
}

describe("ZIP backfill (Section 11)", () => {
  it("backfills when the city+state has exactly one known ZIP", () => {
    const units = [
      unit({ postal_code: "78701" }),
      unit({ postal_code: "" }),
    ];
    backfillZips(units);
    expect(units[1].postal_code).toBe("78701");
    expect(units[1].flag_reasons).toEqual([]);
  });

  it("leaves blank and flags ambiguous_zip when multiple ZIPs exist", () => {
    const units = [
      unit({ postal_code: "78701" }),
      unit({ postal_code: "78702" }),
      unit({ postal_code: "" }),
    ];
    backfillZips(units);
    expect(units[2].postal_code).toBe("");
    expect(units[2].flag_reasons).toContain("ambiguous_zip");
  });

  it("normalizes a trailing .0 from numeric ZIP exports", () => {
    const units = [unit({ postal_code: "78701.0" })];
    backfillZips(units);
    expect(units[0].postal_code).toBe("78701");
  });
});
