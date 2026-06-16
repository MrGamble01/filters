import { describe, it, expect } from "vitest";
import { detectPlatform, detectCompany } from "../lib/ingest/detect";
import { SEED_COMPANIES } from "../lib/seed/companies";

describe("auto-detection (drop-a-file)", () => {
  it("detects AppFolio from headers", () => {
    const headers = [
      "Property Name",
      "Property Street Address 1",
      "Unit",
      "Tenant",
      "Status",
      "Tenant Type",
      "Charge Date",
      "Unit Tags",
    ];
    expect(detectPlatform(headers).platform).toBe("appfolio");
  });

  it("detects Beagle from headers", () => {
    const headers = [
      "First Name",
      "Last Name",
      "Street Address",
      "Zip Code",
      "Filter Size",
      "Quantity",
    ];
    expect(detectPlatform(headers).platform).toBe("beagle");
  });

  it("detects the company from the filename, distinguishing AL vs TN", () => {
    const tn = detectCompany(
      "20260616_arrowpropertymanagement_inc._tn_.csv",
      SEED_COMPANIES,
    );
    expect(tn?.company.gr_code).toBe("GR0295"); // (TN), not (AL) = GR0294
    const al = detectCompany(
      "20260616_arrowpropertymanagement_inc._al_.csv",
      SEED_COMPANIES,
    );
    expect(al?.company.gr_code).toBe("GR0294");
  });

  it("returns nothing when the filename has no company", () => {
    expect(detectCompany("export_2026.csv", SEED_COMPANIES)).toBeUndefined();
  });
});
