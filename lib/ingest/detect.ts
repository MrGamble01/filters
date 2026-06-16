import type { Company, PlatformKey } from "../engine/types";

/**
 * Best-effort auto-detection so the user can just drop a file:
 * - platform from the header columns
 * - company from the filename (company names are embedded, e.g.
 *   "20260616_arrowpropertymanagement_inc._tn_.csv")
 */

const PLATFORM_SIGNATURES: Record<PlatformKey, string[]> = {
  appfolio: [
    "property street address 1",
    "charge date",
    "tenant type",
    "primary tenant",
    "unit tags",
    "lease to",
  ],
  beagle: ["filter size", "quantity", "street address", "zip code"],
  buildium: ["rental", "lease status", "address line 1"],
  rentvine: ["property", "unit", "tenant", "status"],
  rentmanager: ["property", "tenant", "status"],
};

const PLATFORM_ORDER: PlatformKey[] = [
  "appfolio",
  "beagle",
  "buildium",
  "rentvine",
  "rentmanager",
];

export function detectPlatform(headers: string[]): {
  platform: PlatformKey;
  score: number;
} {
  const have = new Set(headers.map((h) => h.trim().toLowerCase()));
  let best: PlatformKey = "appfolio";
  let bestScore = -1;
  for (const platform of PLATFORM_ORDER) {
    const score = PLATFORM_SIGNATURES[platform].filter((c) =>
      have.has(c),
    ).length;
    if (score > bestScore) {
      best = platform;
      bestScore = score;
    }
  }
  return { platform: best, score: bestScore };
}

function compact(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Match the longest company (or alias) name that appears as a contiguous
 * substring of the filename. Requires length >= 5 to avoid spurious hits.
 */
export function detectCompany(
  filename: string,
  companies: Company[],
): { company: Company; matched: string } | undefined {
  const fileCompact = compact(filename);
  let best: { company: Company; matched: string } | undefined;
  let bestLen = 4;

  for (const company of companies) {
    const candidates = [company.name, ...(company.aliases ?? [])];
    for (const cand of candidates) {
      const c = compact(cand);
      if (c.length > bestLen && fileCompact.includes(c)) {
        best = { company, matched: cand };
        bestLen = c.length;
      }
    }
  }
  return best;
}
