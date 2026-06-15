import { describe, it, expect } from "vitest";
import {
  extractFilterSizes,
  normalizeTriple,
} from "../lib/engine/pipeline/filterSize";

describe("filter-size extraction & normalization (Section 8)", () => {
  it("strips a quantity prefix: '2 x 25x25x1' -> 25x25x1", () => {
    expect(extractFilterSizes("2 x 25x25x1").sizes).toEqual(["25x25x1"]);
  });

  it("strips a dash quantity prefix: '2-20x20x1' -> 20x20x1", () => {
    expect(extractFilterSizes("2-20x20x1").sizes).toEqual(["20x20x1"]);
  });

  it("orders width <= height: '20x16x1' -> 16x20x1", () => {
    expect(extractFilterSizes("20x16x1").sizes).toEqual(["16x20x1"]);
  });

  it("misplaced-1 fix: '1x20x20' -> 20x20x1", () => {
    expect(normalizeTriple(1, 20, 20)).toEqual({ size: "20x20x1" });
    expect(extractFilterSizes("1x20x20").sizes).toEqual(["20x20x1"]);
  });

  it("misplaced-1 fix: '1x20x24' -> 20x24x1", () => {
    expect(normalizeTriple(1, 20, 24)).toEqual({ size: "20x24x1" });
    expect(extractFilterSizes("1x20x24").sizes).toEqual(["20x24x1"]);
  });

  it("'1x1x20' -> FLAG ambiguous_size_review (more than one dim = 1)", () => {
    expect(normalizeTriple(1, 1, 20)).toEqual({ flag: "ambiguous_size_review" });
    const r = extractFilterSizes("1x1x20");
    expect(r.sizes).toEqual([]);
    expect(r.flags).toContain("ambiguous_size_review");
  });

  it("2D + keyword -> default depth: '20x20' with 'filter' -> 20x20x1", () => {
    expect(extractFilterSizes("Air filter 20x20").sizes).toEqual(["20x20x1"]);
  });

  it("2D without a filter keyword is not a size", () => {
    expect(extractFilterSizes("room 20x20").sizes).toEqual([]);
  });

  it("depth > 6 -> FLAG: '20x20x8'", () => {
    const r = extractFilterSizes("20x20x8");
    expect(r.sizes).toEqual([]);
    expect(r.flags).toContain("ambiguous_size_review");
  });

  it("keeps multiple distinct sizes in one tag string", () => {
    expect(extractFilterSizes("16x20x1, 20x25x1").sizes).toEqual([
      "16x20x1",
      "20x25x1",
    ]);
  });

  it("normalizes unicode and asterisk separators", () => {
    expect(extractFilterSizes("16×20×1").sizes).toEqual(["16x20x1"]);
    expect(extractFilterSizes("16*20*1").sizes).toEqual(["16x20x1"]);
  });
});
