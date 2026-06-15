import { describe, it, expect } from "vitest";
import { selectUnits } from "../lib/engine/pipeline/status";
import { makeRow } from "./factory";

const COMPANY = "Keystone Signature Properties";

describe("status filter / unit dedup / tenant selection (Section 7)", () => {
  it("collapses AppFolio charge-date triplicates (all Current) to one row", () => {
    const rows = [
      makeRow({ unit: "101", lease_status: "Current", raw: { charge: "2026-01" } }),
      makeRow({ unit: "101", lease_status: "Current", raw: { charge: "2026-02" } }),
      makeRow({ unit: "101", lease_status: "Current", raw: { charge: "2026-03" } }),
    ];
    const { selected } = selectUnits(rows, {
      company: COMPANY,
      outputType: "shipstation",
    });
    expect(selected).toHaveLength(1);
  });

  it("{Past, Notice} -> the Notice row is selected", () => {
    const rows = [
      makeRow({ unit: "5", lease_status: "Past", tenant_name: "Old Tenant" }),
      makeRow({ unit: "5", lease_status: "Notice", tenant_name: "New Tenant" }),
    ];
    const { selected } = selectUnits(rows, {
      company: COMPANY,
      outputType: "shipstation",
    });
    expect(selected).toHaveLength(1);
    expect(selected[0].status).toBe("Notice");
    expect(selected[0].row.tenant_name).toBe("New Tenant");
  });

  it("Past-only unit -> FLAG past_only_unit for ShipStation", () => {
    const rows = [makeRow({ unit: "9", lease_status: "Past" })];
    const { selected, flagged } = selectUnits(rows, {
      company: COMPANY,
      outputType: "shipstation",
    });
    expect(selected).toHaveLength(0);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].reason).toBe("past_only_unit");
  });

  it("Past-only unit -> excluded entirely for Dashboard (no flag)", () => {
    const rows = [makeRow({ unit: "9", lease_status: "Past" })];
    const { selected, flagged } = selectUnits(rows, {
      company: COMPANY,
      outputType: "dashboard",
    });
    expect(selected).toHaveLength(0);
    expect(flagged).toHaveLength(0);
  });

  it("Future unit -> excluded entirely for Dashboard (Current+Notice+Evict only)", () => {
    const rows = [makeRow({ unit: "9", lease_status: "Future" })];
    const { selected } = selectUnits(rows, {
      company: COMPANY,
      outputType: "dashboard",
    });
    expect(selected).toHaveLength(0);
  });

  it("two Current rows, one Primary=Yes -> the primary is selected", () => {
    const rows = [
      makeRow({ unit: "3", lease_status: "Current", is_primary_tenant: false, tenant_name: "Co Tenant" }),
      makeRow({ unit: "3", lease_status: "Current", is_primary_tenant: true, tenant_name: "Primary Tenant" }),
    ];
    const { selected } = selectUnits(rows, {
      company: COMPANY,
      outputType: "shipstation",
    });
    expect(selected).toHaveLength(1);
    expect(selected[0].row.tenant_name).toBe("Primary Tenant");
  });

  it("uses the longest unit_tags in the group as canonical", () => {
    const rows = [
      makeRow({ unit: "7", unit_tags: "16x20x1" }),
      makeRow({ unit: "7", unit_tags: "16x20x1, 20x25x1" }),
    ];
    const { selected } = selectUnits(rows, {
      company: COMPANY,
      outputType: "shipstation",
    });
    expect(selected[0].row.unit_tags).toBe("16x20x1, 20x25x1");
  });
});
