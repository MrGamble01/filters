import { describe, it, expect } from "vitest";
import { processIntermediate } from "../lib/engine/process";
import { SHIPSTATION_COLUMNS } from "../lib/engine/output/shipstation";
import { makeRow, TEST_COMPANY } from "./factory";

describe("end-to-end multi-size handling (Section 12)", () => {
  it("ShipStation: two sizes -> one row, comma-joined Custom Field 1", () => {
    const rows = [makeRow({ unit: "1", unit_tags: "16x20x1, 20x25x1" })];
    const result = processIntermediate(rows, {
      company: TEST_COMPANY,
      platform: "appfolio",
      outputType: "shipstation",
    });
    expect(result.send).toHaveLength(1);
    expect(result.send[0].filter_sizes).toEqual(["16x20x1", "20x25x1"]);
    expect(result.sendCsv.split("\r\n")[1]).toContain("16x20x1, 20x25x1");
  });

  it("Dashboard: two sizes -> two rows", () => {
    const rows = [makeRow({ unit: "1", unit_tags: "16x20x1, 20x25x1" })];
    const result = processIntermediate(rows, {
      company: TEST_COMPANY,
      platform: "appfolio",
      outputType: "dashboard",
    });
    expect(result.send).toHaveLength(2);
    expect(result.send.map((r) => r.filter_sizes[0])).toEqual([
      "16x20x1",
      "20x25x1",
    ]);
  });
});

describe("end-to-end output shape (Sections 15–16)", () => {
  it("ShipStation header is the canonical column order with GR code in CF3", () => {
    const rows = [makeRow({ unit: "1", unit_tags: "16x20x1" })];
    const result = processIntermediate(rows, {
      company: TEST_COMPANY,
      platform: "appfolio",
      outputType: "shipstation",
    });
    expect(result.sendCsv.split("\r\n")[0]).toBe(SHIPSTATION_COLUMNS.join(","));
    const rec = result.send[0];
    expect(rec.recipient_name).toBe("Jane Doe");
    expect(result.sendCsv).toContain(TEST_COMPANY.gr_code);
  });

  it("Dashboard emits exactly Name, Size, Address 1, Address 2", () => {
    const rows = [makeRow({ unit: "1", unit_tags: "16x20x1" })];
    const result = processIntermediate(rows, {
      company: TEST_COMPANY,
      platform: "appfolio",
      outputType: "dashboard",
    });
    expect(result.sendCsv.split("\r\n")[0]).toBe("Name,Size,Address 1,Address 2");
  });
});

describe("end-to-end missing-size & auto-fill (Section 8)", () => {
  it("no size -> FLAGS with missing_size (dashboard never auto-fills)", () => {
    const rows = [makeRow({ unit: "1", unit_tags: "no size here" })];
    const result = processIntermediate(rows, {
      company: TEST_COMPANY,
      platform: "appfolio",
      outputType: "dashboard",
      autoFillSize: true, // ignored for dashboard
    });
    expect(result.send).toHaveLength(0);
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].flag_reasons).toContain("missing_size");
  });

  it("ShipStation auto-fill uses the company default when enabled", () => {
    const rows = [makeRow({ unit: "1", unit_tags: "no size here" })];
    const result = processIntermediate(rows, {
      company: TEST_COMPANY,
      platform: "appfolio",
      outputType: "shipstation",
      autoFillSize: true,
    });
    expect(result.flags).toHaveLength(0);
    expect(result.send[0].filter_sizes).toEqual(["16x20x1"]);
  });

  it("ShipStation without auto-fill flags missing_size", () => {
    const rows = [makeRow({ unit: "1", unit_tags: "no size here" })];
    const result = processIntermediate(rows, {
      company: TEST_COMPANY,
      platform: "appfolio",
      outputType: "shipstation",
    });
    expect(result.flags[0].flag_reasons).toContain("missing_size");
  });
});
