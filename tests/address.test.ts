import { describe, it, expect } from "vitest";
import {
  splitAddress,
  resolveAddress,
  isUnitDesignator,
  buildUnitFieldIsAddress,
} from "../lib/engine/pipeline/address";
import { makeRow } from "./factory";
import type { Company } from "../lib/engine/types";

describe("address handling (Section 9)", () => {
  it("splits a trailing designator from the street", () => {
    expect(splitAddress("405 BERMUDA UNIT D")).toEqual({
      address1: "405 BERMUDA",
      address2: "UNIT D",
    });
    expect(splitAddress("142 WOLF RD APT B")).toEqual({
      address1: "142 WOLF RD",
      address2: "APT B",
    });
  });

  it("Unit equals property name -> Address 2 blank", () => {
    const row = makeRow({
      property_name: "Maple Property",
      unit: "Maple Property",
      street_address1: "123 Main St",
    });
    expect(resolveAddress(row, false)).toEqual({
      address1: "123 Main St",
      address2: "",
    });
  });

  it("property-nickname unit value -> Address 2 blank", () => {
    expect(isUnitDesignator("The Oaks")).toBe(false);
    const row = makeRow({ unit: "The Oaks", street_address1: "500 Oak Dr" });
    expect(resolveAddress(row, false).address2).toBe("");
  });

  it("genuine designator unit value -> kept in Address 2", () => {
    expect(isUnitDesignator("Apt 4")).toBe(true);
    expect(isUnitDesignator("204")).toBe(true);
    const row = makeRow({ unit: "Apt 4", street_address1: "500 Oak Dr" });
    expect(resolveAddress(row, false)).toEqual({
      address1: "500 Oak Dr",
      address2: "Apt 4",
    });
  });

  it("unit-field-is-address quirk -> address sourced from Unit", () => {
    const row = makeRow({
      street_address1: "Edisto Main Office",
      unit: "77 Beach Rd Apt 2",
    });
    expect(resolveAddress(row, true)).toEqual({
      address1: "77 Beach Rd",
      address2: "Apt 2",
    });
  });

  it("Edisto company quirk makes unitFieldIsAddress true for every row", () => {
    const edisto: Company = {
      name: "Edisto Property Management Group",
      gr_code: "GR0270",
      address_quirk: "unit_field_is_address",
    };
    const rows = [makeRow()];
    const pred = buildUnitFieldIsAddress(rows, edisto, "appfolio");
    expect(pred(rows[0])).toBe(true);
  });

  it("non-quirk company never treats the unit field as the address", () => {
    const company: Company = { name: "X", gr_code: "GR0000" };
    const rows = [
      makeRow({ property_name: "Complex A", unit: "101" }),
      makeRow({ property_name: "Complex A", unit: "102" }),
    ];
    // The speculative AppFolio multi-unit heuristic was removed; real exports
    // keep the street in Address 1 and the designator in Address 2.
    const pred = buildUnitFieldIsAddress(rows, company, "appfolio");
    expect(pred(rows[0])).toBe(false);
  });
});
