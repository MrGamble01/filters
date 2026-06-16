import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../lib/ingest/parseFile";
import { processRaw } from "../lib/engine/process";
import type { Company } from "../lib/engine/types";

// Synthetic export with the real AppFolio column layout (no real PII).
const CSV = readFileSync(
  fileURLToPath(new URL("./fixtures/appfolio_sample.csv", import.meta.url)),
  "utf8",
);

const COMPANY: Company = {
  name: "Arrow Property Management, Inc. (TN)",
  gr_code: "GR0294",
};

function run(outputType: "shipstation" | "dashboard") {
  return processRaw(parseCsv(CSV), {
    company: COMPANY,
    platform: "appfolio",
    outputType,
  });
}

describe("AppFolio adapter against real-shaped export", () => {
  const r = run("shipstation");
  const send = Object.fromEntries(r.send.map((s) => [s.recipient_name, s]));
  const flags = Object.fromEntries(r.flags.map((s) => [s.recipient_name, s]));

  it("collapses charge-date triplicates to one unit", () => {
    expect(r.send.filter((s) => s.recipient_name === "Jane Doe")).toHaveLength(1);
  });

  it("builds the name from First/Last (not the 'Last, First' Tenant column)", () => {
    expect(send["Jane Doe"]).toBeDefined();
    expect(send["Al Adams"]).toBeDefined();
  });

  it("sources address from Property Street Address 1, designator from Address 2", () => {
    expect(send["Al Adams"].address1).toBe("200 Pine St");
    expect(send["Al Adams"].address2).toBe("Unit A");
    expect(send["Bo Bell"].address2).toBe("Unit B");
  });

  it("keeps multi-unit buildings separate (no over-merge on Unit column)", () => {
    expect(send["Al Adams"]).toBeDefined();
    expect(send["Bo Bell"]).toBeDefined();
  });

  it("suppresses a property nickname in Address 2", () => {
    expect(send["Cara Cole"].address1).toBe("300 Elm St");
    expect(send["Cara Cole"].address2).toBe("");
  });

  it("repeats sizes by quantity for ShipStation", () => {
    expect(send["Bo Bell"].filter_sizes).toEqual(["20x25x1", "20x25x1"]);
  });

  it("extracts the size from a free-form Unit Tags string", () => {
    expect(send["Jane Doe"].filter_sizes).toEqual(["16x20x1"]);
  });

  it("takes only the first email when the cell has several", () => {
    expect(send["Fay Fox"].email).toBe("fay1@x.com");
  });

  it("flags a unit with no parseable size as missing_size", () => {
    expect(flags["Dan Day"].flag_reasons).toContain("missing_size");
  });

  it("flags a past-only unit (ShipStation)", () => {
    expect(flags["Eve East"].flag_reasons).toContain("past_only_unit");
  });
});
