import type { Company } from "../engine/types";
import { GR_LOOKUP, SEED_COMPANIES } from "./grLookup";

/**
 * Company source of truth (794 entries) ported from the legacy app's GR_LOOKUP.
 * `SEED_COMPANIES` and `GR_LOOKUP` are generated in ./grLookup.ts.
 */
export { GR_LOOKUP, SEED_COMPANIES };

export const SEED_PLATFORMS = [
  { key: "appfolio", name: "AppFolio" },
  { key: "rentvine", name: "Rentvine" },
  { key: "buildium", name: "Buildium" },
  { key: "rentmanager", name: "RentManager" },
  { key: "beagle", name: "Beagle" },
] as const;

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Resolve a company by exact name or alias (case-insensitive). */
export function resolveCompany(nameOrAlias: string): Company | undefined {
  const needle = norm(nameOrAlias);
  return SEED_COMPANIES.find(
    (c) =>
      norm(c.name) === needle ||
      (c.aliases ?? []).some((a) => norm(a) === needle),
  );
}

/** Resolve a GR code from a raw company name via the lookup map. */
export function resolveGrCode(name: string): string | undefined {
  return GR_LOOKUP[norm(name)] ?? resolveCompany(name)?.gr_code;
}
