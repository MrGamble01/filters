import type { Company } from "../engine/types";

/**
 * Seed companies & GR codes (Section 18). Aliases map known export-name variants
 * to one company; Edisto carries the unit_field_is_address quirk.
 */
export const SEED_COMPANIES: Company[] = [
  { name: "StarPointe Realty", gr_code: "GR0022" },
  { name: "Reliant", gr_code: "GR0025" },
  { name: "Sleep Sound", gr_code: "GR0160", aliases: ["Sleepy Sound"] },
  { name: "AllStates", gr_code: "GR0250" },
  { name: "43 Realty", gr_code: "GR0265" },
  { name: "Global Realty", gr_code: "GR0267" },
  {
    name: "Edisto Property Management Group",
    gr_code: "GR0270",
    address_quirk: "unit_field_is_address",
  },
  { name: "Flagship Property Management", gr_code: "GR0279" },
  {
    name: "Arrow Property Management",
    gr_code: "GR0294",
    aliases: ["Arrow AL", "Arrow TN"],
  },
  {
    name: "Keystone Signature Properties",
    gr_code: "GR0296",
    aliases: ["Sig Property Management"],
  },
  { name: "Five Star Real Estate & PM", gr_code: "GR0299" },
  { name: "Stars & Stripes", gr_code: "GR0302" },
  { name: "Remi Emerson", gr_code: "GR0303", aliases: ["YRIG"] },
  { name: "JAZ", gr_code: "GR0357" },
  { name: "Red Door Property Management", gr_code: "GR0386" },
  { name: "Freedom House", gr_code: "GR0387" },
  { name: "SunCoast", gr_code: "GR0541" },
  { name: "Hylton & Company", gr_code: "GR0592" },
  { name: "Vesta Property Management", gr_code: "GR0671" },
  { name: "PMI Raleighwood", gr_code: "GR0680" },
  { name: "Sheffield", gr_code: "GR0734" },
  { name: "Endeavour Realty", gr_code: "GR0792" },
  { name: "Mission Real Estate", gr_code: "GR0798" },
  { name: "Innovative Realty", gr_code: "GR0802" },
  { name: "PMI River City", gr_code: "GR0806" },
  {
    name: "J R Grace Realty LLC",
    gr_code: "GR0159",
    aliases: ["JR Grace", "J R Grace Realty"],
  },
];

export const SEED_PLATFORMS = [
  { key: "appfolio", name: "AppFolio" },
  { key: "rentvine", name: "Rentvine" },
  { key: "buildium", name: "Buildium" },
  { key: "rentmanager", name: "RentManager" },
  { key: "beagle", name: "Beagle" },
] as const;

/** Resolve a company by exact name or alias (case-insensitive). */
export function resolveCompany(nameOrAlias: string): Company | undefined {
  const needle = nameOrAlias.trim().toLowerCase();
  return SEED_COMPANIES.find(
    (c) =>
      c.name.toLowerCase() === needle ||
      (c.aliases ?? []).some((a) => a.toLowerCase() === needle),
  );
}
