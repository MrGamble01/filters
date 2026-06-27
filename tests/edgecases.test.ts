import { describe, it, expect } from "vitest";
import { extractFilterSizes } from "../lib/engine/pipeline/filterSize";
import { normalizeName } from "../lib/engine/pipeline/name";
import { normalizeStatus } from "../lib/engine/pipeline/status";

describe("filter-size edge cases (regressions)", () => {
  it("keeps decimal/half sizes intact", () => {
    expect(extractFilterSizes("12.5x21x1").sizes).toEqual(["12.5x21x1"]);
    expect(extractFilterSizes("21.5x15.5x1").sizes).toEqual(["15.5x21.5x1"]);
  });

  it("does not fabricate a size from a 3-digit/typo number", () => {
    // "165x20x1" must NOT become "20x65x1"; with no valid size it's unparsed.
    expect(extractFilterSizes("165x20x1").sizes).toEqual([]);
  });

  it("ignores trailing MERV ratings", () => {
    expect(extractFilterSizes("20x20x1 MERV 13").sizes).toEqual(["20x20x1"]);
  });

  it("quantity prefix with a count of 3 repeats three times", () => {
    expect(extractFilterSizes("3x 16x20x1").sizes).toEqual([
      "16x20x1",
      "16x20x1",
      "16x20x1",
    ]);
  });
});

describe("name 'Last, First' reordering", () => {
  it("reorders Last, First to First Last", () => {
    expect(normalizeName("Doe, Jane", "Acme").name).toBe("Jane Doe");
    expect(normalizeName("JONES,MARY", "Acme").name).toBe("MARY JONES");
    expect(normalizeName("Doe, Jane D.", "Acme").name).toBe("Jane D. Doe");
  });

  it("keeps name suffixes in place", () => {
    expect(normalizeName("Smith, Jr.", "Acme").name).toBe("Smith Jr");
  });

  it("does not reorder LLC names", () => {
    expect(normalizeName("Acme Holdings, LLC.", "Acme").name).toBe(
      "Acme Holdings LLC",
    );
  });

  it("keeps a plain First Last name", () => {
    expect(normalizeName("Jane Doe", "Acme").name).toBe("Jane Doe");
  });
});

describe("status synonyms", () => {
  it("treats renewing / holdover / month-to-month as active", () => {
    expect(normalizeStatus("Renewing")).toBe("Current");
    expect(normalizeStatus("Holdover")).toBe("Current");
    expect(normalizeStatus("Month-to-Month")).toBe("Current");
  });
});
