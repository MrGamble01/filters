import { describe, it, expect } from "vitest";
import {
  applyDedupPolicy,
  dedupNames,
  dedupPolicyFromKey,
  type Shipment,
} from "../lib/clientStore";

const NOW = Date.parse("2026-06-17T00:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

const SHIPMENTS: Shipment[] = [
  { id: "a", grCode: "GR1", date: daysAgo(1), source: "f1", names: ["Alice"] },
  { id: "b", grCode: "GR1", date: daysAgo(5), source: "f2", names: ["Bob"] },
  { id: "c", grCode: "GR1", date: daysAgo(20), source: "f3", names: ["Cara"] },
];

describe("dedup scope policies", () => {
  it("parses policy keys", () => {
    expect(dedupPolicyFromKey("last:1")).toEqual({ mode: "last", count: 1 });
    expect(dedupPolicyFromKey("last:3")).toEqual({ mode: "last", count: 3 });
    expect(dedupPolicyFromKey("days:7")).toEqual({ mode: "days", days: 7 });
    expect(dedupPolicyFromKey("all")).toEqual({ mode: "all" });
  });

  it("defaults to only the last (most recent) send file", () => {
    expect(dedupNames(SHIPMENTS, { mode: "last", count: 1 })).toEqual(["Alice"]);
  });

  it("last 2 unions the two most recent batches", () => {
    expect(dedupNames(SHIPMENTS, { mode: "last", count: 2 }).sort()).toEqual([
      "Alice",
      "Bob",
    ]);
  });

  it("last 7 days keeps batches within the window", () => {
    expect(
      dedupNames(SHIPMENTS, { mode: "days", days: 7 }, NOW).sort(),
    ).toEqual(["Alice", "Bob"]);
  });

  it("all returns every batch", () => {
    expect(applyDedupPolicy(SHIPMENTS, { mode: "all" })).toHaveLength(3);
  });
});
