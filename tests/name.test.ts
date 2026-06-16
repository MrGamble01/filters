import { describe, it, expect } from "vitest";
import { normalizeName } from "../lib/engine/pipeline/name";

describe("name normalization (Section 10)", () => {
  it("keeps parentheticals: 'KIMBERLY DORN (COOPERMAN)' unchanged", () => {
    expect(normalizeName("KIMBERLY DORN (COOPERMAN)", "Acme").name).toBe(
      "KIMBERLY DORN (COOPERMAN)",
    );
  });

  it("keeps quoted segments verbatim", () => {
    expect(normalizeName('Mary "May" Lee', "Acme").name).toBe('Mary "May" Lee');
  });

  it("preserves apostrophes in real names", () => {
    expect(normalizeName("Sean O'Brien", "Acme").name).toBe("Sean O'Brien");
  });

  it("missing name -> '[Company] Resident'", () => {
    expect(normalizeName("", "Keystone Signature Properties").name).toBe(
      "Keystone Signature Properties Resident",
    );
    expect(normalizeName("Current Resident", "Keystone Signature Properties").name).toBe(
      "Keystone Signature Properties Resident",
    );
  });

  it("standardizes LLC: 'Acme Holdings, LLC.' -> 'Acme Holdings LLC'", () => {
    expect(normalizeName("Acme Holdings, LLC.", "Acme").name).toBe(
      "Acme Holdings LLC",
    );
  });
});
